const express = require("express");
const app = express();

const tf = require("@tensorflow/tfjs");
const tfcore = require("@tensorflow/tfjs-node-gpu");
const mobilenet = require("@tensorflow-models/mobilenet");
const knnClassifier = require("@tensorflow-models/knn-classifier")

let classifier = knnClassifier.create();

const fs = require("fs");
let gracefulFs = require("graceful-fs")

gracefulFs.gracefulify(fs)

const formidable = require("formidable");
const bodyParser = require("body-parser");
const image = require("get-image-data");

app.use(bodyParser.json());

const server = require("http").Server(app);

const path = require("path");

const directoryPath = path.join(__dirname, "images");

let training = false;

let model;


fs.readFile("./model.json", "utf-8", async (err, fileData) => {
  model = await mobilenet.load();
  if (err) {
    console.log("Something went wrong while loading the saved trained model")
  }
  else {
    classifier.setClassifierDataset(
      Object.fromEntries(JSON.parse(fileData).map(([label, data, shape]) => [label, tf.tensor(data, shape)]))
    )
  }
})

app.get("/training", async (req, res) => {
  res.status(200).json({
    training: training
  })
})


app.post("/train", async (req, res) => {
  model = await mobilenet.load();
  fs.readdir(directoryPath, async (err, files) => {
    if (err) {
      console.log("Something went wrong in the directory reading part of the process.")
    }

    console.log("Begin training")


    files.forEach((folder, index1) => {
      console.log(`Processing butterfly ${index1 + 1} of ${files.length}`)
      let butterflyType = folder.match(/[^.]+$/g)[0].replace("_", " ")

      let butterflyImages = path.join(directoryPath, folder);

      fs.readdir(butterflyImages, (err, nestedFiles) => {
        nestedFiles.forEach((nestedFile, index2) => {
          console.log(`Processing image ${index2 + 1} of ${nestedFiles.length}`)
          let url = `./images/${folder}/${nestedFile}`

          image(url, (err, parsedImage) => {
            if (err) {
              console.log(err);
              console.log("Something went wrong in parsing an image.")
            }
            else {
              let pixels = parsedImage.data;
              let channels = 3; //One channel for each of Red, Green and Blue

              let vals = new Int32Array(parsedImage.height * parsedImage.width * channels);


              for (let i = 0; i < parsedImage.height * parsedImage.width; i++) {
                for (let j = 0; j < channels; j++) {
                  vals[i * channels + j] = pixels[i * 4 + j]
                }
              }


              let outputShape = [parsedImage.height, parsedImage.width, channels];

              let input = tf.tensor3d(vals, outputShape, "int32")

              let activation = model.infer(input, true)

              classifier.addExample(activation, butterflyType)


              input.dispose();

              console.log("Trained myself to recognise " + butterflyType + " from looking at " + url)
              if (index1 == files.length - 1) {
                training = false
              }
            }
          })
        })
      })


    })

    training = true
    res.status(200).send("Training is in progress");
  })
})



app.post("/save", (req, res) => {

  let str = JSON.stringify(
    Object.entries(classifier.getClassifierDataset()).map(([label, data]) => [label, Array.from(data.dataSync()), data.shape])
  )
  console.log(str)

  fs.writeFile("./model.json", str, function (err) {
    console.log(err)
  })

  res.send("OK")
})




app.post("/image", (req, res) => {
  let form = new formidable.IncomingForm({
    maxFileSize: 10485760, //10MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).send("Something went wrong during upload.");
    } else {
      whatIsThis(files.upload.path)
        .then((imageClassification) => {
          res.status(200).send({
            classification: imageClassification,
          });
        })
        .catch((err) => {
          console.log(err);
          res
            .status(500)
            .send("Something went wrong while fetching image from URL.");
        });
    }
  });
});

app.post("/image-from-url", async (req, res) => {
  whatIsThis(req.body.url)
    .then((imageClassification) => {
      res.status(200).send({
        classification: imageClassification,
      });
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .send("Something went wrong while fetching image from URL.");
    });
});

function whatIsThis(url) {
  return new Promise((resolve, reject) => {
    image(url, async (err, image) => {
      if (err) {
        reject(err);
      } else {
        const channelCount = 3;
        const pixelCount = image.width * image.height;
        const vals = new Int32Array(pixelCount * channelCount);

        let pixels = image.data;

        for (let i = 0; i < pixelCount; i++) {
          for (let k = 0; k < channelCount; k++) {
            vals[i * channelCount + k] = pixels[i * 4 + k];
          }
        }

        const outputShape = [image.height, image.width, channelCount];

        const input = tf.tensor3d(vals, outputShape, "int32");

        const activation = model.infer(input, true)

        let temp = await classifier.predictClass(activation)

        resolve(temp);
      }
    });
  });
}

const port = process.env.PORT || 80;



app.use(express.static(path.join(__dirname, "client/build")));

app.get("*", (req, res) => {
  res.sendFile("./client/build/index.html", { root: __dirname });
});

server.listen(port, (req, res) => {
  console.log(`Server is up and running @ port ${port}`);
});
