const nodeFetch = require("node-fetch");
const Moysklad = require("moysklad");
const moment = require("moment");

const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

const prettifyPhone = (phone) => {
  const raw = phone.replace(/\D/g, '');
  if (raw.length < 11) {
    return null;
  }

  return `+${raw[0]}(${raw.substr(1,3)}) ${raw.substr(4,3)}-${raw.substr(7,2)}-${raw.substr(9,2)}`;
}

const prepareAttribute = (attribute, cb) => {
  if (attribute) {
    if (attribute.value) {
      const valueType = typeof attribute.value;
      let value;
      if (valueType == "object") {
        value = attribute.value.name;
      } else {
        value = attribute.value;
      }

      if (cb && typeof cb == "function") {
        return cb(value);
      } else {
        return value;
      }
    }
  } else {
    return null;
  }
}

module.exports = class TaskProvider {
  constructor(config) {
    this.ms = new Moysklad({
      fetch: nodeFetch,
      login: config.login,
      password: config.password
    });
    this.tasks = [];
  }

  fetchTasks() {
    const today = moment(new Date()).startOf("day")
    const tomorrow = today.clone().add(1, "days");

    return new Promise((resolve, reject) => {
      this.ms.GET("entity/customerorder", {
        filter: {
          deliveryPlannedMoment: {
            $gt: today.format(DATE_FORMAT),
            $lt: tomorrow.format(DATE_FORMAT)
          }
        },
        order: "deliveryPlannedMoment,asc",
      }).then(({
        rows
      }) => {
        let transportedTaskCount = 0;
        const tasks = rows.map(v => {
          let attributes = {};
          v.attributes.map(attr => {
            attributes[attr.name] = attr;
          });

          const attributeAddress = attributes["Адрес доставки"];
          const attributeName = attributes["Ф.И.О."];
          const attributePhone = attributes["Телефон"];
          const attributeReceiverName = attributes["Имя получателя"];
          const attributeReceiverPhone = attributes["Телефон получателя"];
          const attrebuteDeliverBy = attributes["Часы доставки"];
          const attributePaymentMethod = attributes["Способ оплаты"];
          const attributeTC = attributes["ТК"];
          const attributeTCity = attributes["Город"];
          const attributeTDocument = attributes["ТК: N накладной"];
          const attributeComment = attributes["Комментарий водителю"];

          console.log(v.demands);

          if (attributeTC) {
            transportedTaskCount++;
          }

          return {
            id: v.id,
            code: v.name,
            summ: v.sum,
            address: prepareAttribute(attributeAddress),
            name: prepareAttribute(attributeName),
            phone: prepareAttribute(attributePhone, attr => prettifyPhone(attr)),
            receiverName: prepareAttribute(attributeReceiverName),
            receiverPhone: prepareAttribute(attributeReceiverPhone, attr => prettifyPhone(attr)),
            deliverBy: prepareAttribute(attrebuteDeliverBy),
            payed: v.sum > 0 && v.payedSum >= v.sum,
            shipped: v.sum > 0 && v.shippedSum == v.sum,
            payByCard: prepareAttribute(attributePaymentMethod, attr => attr == "Банковской картой курьеру") || false,
            transportCompany: prepareAttribute(attributeTC),
            transportCompanyCity: prepareAttribute(attributeTCity),
            transportDocument: prepareAttribute(attributeTDocument),
            comment: prepareAttribute(attributeComment),
            status: v.state.meta.href.substr(v.state.meta.href.lastIndexOf("/") + 1)
          }
        });

        resolve({
          tasks: tasks,
          transportedTaskCount: transportedTaskCount
        });
      }).catch(err => {
        reject(err);
      })
    });
  }

  fetchOrderPositions(id) {
    return new Promise((resolve, reject) => {
      this.ms.GET(`entity/customerorder/${id}/positions`).then(({
        rows
      }) => {
        const positions = rows.reduce((f, v) => {

          if (v.assortment.meta.type == "product") {
            const href = v.assortment.meta.href;

            f.push({
              id: v.id,
              quantity: v.quantity,
              assortment: href.substr(href.lastIndexOf('/') + 1)
            });
          }

          return f;
        }, []);

        resolve({
          positions: positions
        });
      }).catch(err => {
        reject(err);
      })
    });
  }

  fetchAssortment(id) {
    return new Promise((resolve, reject) => {
      this.ms.GET(`entity/product/${id}`).then(product => {
        resolve({
          name: product.name,
          code: product.code ? product.code : null
        });
      }).catch(err => {
        reject(err);
      })
    });
  }

  fetchStatus(id) {
    return new Promise((resolve, reject) => {
      this.ms.GET(`entity/customerorder/metadata/states/${id}`).then(state => {
        resolve({
          inactive: [
            "Согласовать с клиентом",
            "Ждем подтверждение",
            "Ждем оплату"
          ].indexOf(state.name) != -1
        });
      }).catch(err => {
        reject(err);
      })
    })
  }

  setApplicable(id) {
    return new Promise((resolve, reject) => {
      this.ms.PUT(`/entity/customerorder/${id}`, {
        applicable: true
      }).then(task => {
        console.log(task);
        resolve({
          applicable: task.applicable
        });
      }).catch(err => {
        reject(err);
      })
    })
  }
}