import React from "react";
import logo from "./logo.svg";
import "antd/dist/antd.css";
import "./App.css";
import { Upload, message, Tooltip, Button, Input, Spin } from "antd";
import * as axios from "axios";
import { UploadOutlined } from "@ant-design/icons";

function App() {
  const [classification, setClassification] = React.useState();
  const [training, setTraining] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [url, setUrl] = React.useState();

  const handleUrlRequest = (evt) => {
    setProcessing(true)
    axios.post(`/image-from-url`, { url: url }).then((response) => {
      setProcessing(false)
      setClassification(response.data.classification);
    });
  };

  const checkIfTraining = evt => {
    axios.get(`/status`).then(response => {
      setTraining(response.data.training)
    })
  }

  React.useEffect(() => {
    checkIfTraining()
  }, [])

  return (
    <div className="App" style={{ maxWidth: 1000, padding: "1em", margin: "auto" }}>
      <h1>Butterflix</h1>
      <p>Identify butterflies from images.</p>
      {classification ? (
        <div>
          <div>
            I'm {classification.confidences[classification.label].toPrecision(4) * 100}% sure that this is:
            </div>
          <div style={{ fontStyle: "bold", fontSize: "2em" }}>{classification.label}</div>

          <Button
            type={"primary"}
            onClick={(evt) => {
              setClassification();
              setUrl();
            }}
          >
            Start over
          </Button>
        </div>
      ) : (
          <div>
            {training == true || processing == true ? <div>
              <Spin />
              {training == true ? <h3>I'm currently busy with learning all about butterflies. Please try again later.</h3> : null}
              {processing == true ? <h3>I'm trying to figure out what that was... Please wait.</h3> : null}
            </div> : null
            }

            <span style={{ display: training == true || processing == true ? "none" : "block" }}>
              <Upload
                name={"upload"}
                showUploadList={false}
                action={`/image`}
                onChange={(info) => {
                  setProcessing(true)
                  if (info.file.status == "done") {
                    setProcessing(false)
                    setClassification(info.file.response.classification);
                  } else if (info.file.status === "error") {
                    setProcessing(false)
                    message.error(info.file.response);
                  }
                }}
              >
                <Tooltip title={"Upload an image"}>
                  <Button icon={<UploadOutlined />} />
                </Tooltip>
              </Upload>
              <div style={{ textAlign: "center" }}>or</div>
              <Input
                onChange={(evt) => setUrl(evt.target.value)}
                placeholder={"Or paste a link..."}
              />
              <Button onClick={() => handleUrlRequest()}>Go</Button>
            </span>
          </div>
        )}
    </div>
  );
}

export default App;
