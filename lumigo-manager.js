const express = require("express");
const port = 8000;
const cluster = require("cluster");
const fs = require('fs');
const logFile = 'lumigo_manager.txt';


// Global scop parameters:
var active_instances = 0;
var total_invocation = 0;
var isWriting = false;
var activeProcesses = [];
var availableWorkers = {};
var workersQueue = [];



if (cluster.isMaster) {
  const app = express();
  app.use(express.json());

  // POST messages
  app.post('/messages', function (req, res) {
    // getting message : req.body.message
    var foundAvailWorker = false;
    if(req.body.message){
        //poping the older worker and check if avail to work
        while (worker_id =  workersQueue.shift()){
            if (availableWorkers[worker_id]){
                var worker = cluster.workers[worker_id];
                foundAvailWorker = true;
                break;
            }     
        }
        if(!foundAvailWorker){
            var worker = cluster.fork();
            active_instances++;
        }
        total_invocation++;
        worker.send({ message : req.body.message});
        worker.on('message', function(msg) {
            if (msg == "Done"){
               availableWorkers[worker.id] = true;
               workersQueue.push(worker.id);
               setTimeout(function () {
                    availableWorkers[worker.id] = false;
                    if (active_instances) active_instances--;
                    worker.kill();
               },10000);
            }
        });
    }
    res.send();
  })

  app.get("/statistics", (req, res) => {
    let output = 
     {
         active_instances: active_instances, // Number of function instances that are active
         total_invocation: total_invocation // How many times the function got invocated
     }
    res.send(output);
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.id} died`);
  });

  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });



} else {
  // Workers:
  console.log(`Worker ${cluster.worker.id} started`);
  process.on('message', data => {
    //the message triggered function for this worker:
    var inputMessage = data.message + "\n";
    setTimeout(function () {
        //setting interval 500 milisec to write to the file
        const writeInterval = setInterval(async() => {
            if (!isWriting) {
                isWriting = true;
                if (fs.existsSync(logFile)) {
                    fs.appendFileSync(logFile, inputMessage);
                    console.log(`${inputMessage} > ${logFile}`);
                }
                isWriting = false;
                clearInterval(writeInterval);
                process.send("Done");
            }   
        }, 500);
    }, 1000);
  }); 
}