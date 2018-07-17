const bodyParser = require("body-parser");
const express = require("express");
const path = require("path");

const TaskProvider = require("./TaskProvider");

const PORT = process.env.PORT | 8080;
const config = require("./config.json");

// Methods
const createPath = (file) => {
  return path.join(__dirname, `views/${file}`);
};

// Configure app
const app = express();
const tp = new TaskProvider(config.moysklad);

// Use middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get("/assortment/:id", (req, res) => {
  tp.fetchAssortment(req.params.id).then(assortment => {
    res.send(assortment);
  })
})

app.get("/positions/:id", (req, res) => {
  tp.fetchOrderPositions(req.params.id).then(positions => {
    res.send(positions);
  });
});

app.get("/status/:id", (req, res) => {
  tp.fetchStatus(req.params.id).then(status => {
    res.send(status);
  })
});

app.get("/tasks", (req, res) => {
  tp.fetchTasks().then(tasks => {
    res.send(tasks);
  });
});

app.post("/task/applicable", (req, res) => {
  tp.setApplicable(req.body.id).then(task => {
    res.send(task);
  });
});

app.get("/", (req, res) => {
  res.sendFile(createPath("main.html"));
});

app.use(function (req, res, next) {
  res.status(404);
  return "404";
});

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500);
  return "500";
});

//Start server
app.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});