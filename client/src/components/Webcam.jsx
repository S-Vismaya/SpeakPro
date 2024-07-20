import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import useSocket from "../hooks/socket";
import { extMap, sortAndFilterEmotions } from "../utils/emotionFilter";
import axios from "axios";
import VideoPlayer from "./VideoPlayer";
import ReactLoading from "react-loading";
import { useAuth0 } from "@auth0/auth0-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ResponsiveContainer,
  Label,
  AreaChart,
  BarChart,
  Bar,

  // linearGradient,
} from "recharts";

export default function WebcamVideo() {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const cap2 = useRef(false);
  const [webcam, setWebcam] = useState(false);
  const [data, setData] = useState(null);
  const [allEmotions, setAllEmotions] = useState([]);
  const [showEmotions, setShowEmotions] = useState(false);
  const [isScrubbable, setIsScrubbable] = useState(false);
  const [blob, setBlob] = useState(null);
  const startTime = useRef(null);
  const endTime = useRef(null);
  const [loading, setLoading] = useState(false);
  const [vidTime, setVidTime] = useState(0);
  const { user } = useAuth0()

  const [emotionsMap, setEmotionsMap] = useState([
    {
      Calmness: 0,
      Interest: 0,
      Boredom: 0,
      Joy: 0,
      time: 0,
    },
  ]);

  var chunks = [];

  // calmness, interest, Boredom, awkdness

  const getFrame = useCallback(() => {
    if (webcamRef !== null && webcamRef.current !== null) {
      return webcamRef.current.getScreenshot();
    } else {
      return null;
    }
  }, [webcamRef]);

  const [emotions, setEmotions] = useState([]);

  const onEmotionUpdate = useCallback((newEmotions) => {
    if (newEmotions.length == 0) {
      return;
    }
    const n = sortAndFilterEmotions(newEmotions);
    setAllEmotions(n);
  });
  const [socket, stopEverything, capturePhoto] = useSocket({
    getFrame,
    setEmotions,
    onEmotionUpdate,
    capturing: cap2,
  });

  // const handleStartCaptureClick = useCallback(() => {
  //   setCapturing(true);
  //   cap2.current = true;

  //   const stream = webcamRef.current.stream;
  //   mediaRecorderRef.current = new MediaRecorder(stream);

  //   mediaRecorderRef.current.ondataavailable = (event) => {
  //     if (event.data.size > 0) {
  //       chunks.push(event.data);
  //     }
  //   };

  //   mediaRecorderRef.current.onstop = () => {
  //     const blob = new Blob(chunks, { type: "video/webm" });
  //     sendVideoToServer(blob);
  //   };

  //   mediaRecorderRef.current.start();
  // }, [webcamRef, mediaRecorderRef]);

  // const handleStopCaptureClick = useCallback(() => {
  //   mediaRecorderRef.current.stop();
  //   setCapturing(false);
  //   cap2.current = false;
  //   if (chunks.length) {
  //     sendVideoToServer(chunks);
  //   }
  // }, [mediaRecorderRef, setCapturing, chunks]);

  const handleDownload = useCallback(() => {
    if (chunks.length) {
      const blob = new Blob(chunks, {
        type: "video/webm",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = url;
      a.download = "react-webcam-stream-capture.webm";
      a.click();
      window.URL.revokeObjectURL(url);
      chunks = [];
    }
  }, [chunks]);

  const sendVideoToServer = useCallback(async (blob) => {
    try {
      const formData = new FormData();
      formData.append("video", blob, "recorded-video.webm");
      setBlob(blob);
      
      await axios
        .post(`http://localhost:3000/upload-video/${user?.email ?? ''}`, formData)
        .then((res) => {
          console.log(res);
          setData(res.data);
          setLoading(false);
        });
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  }, [user]);

  useEffect(() => {
    if (
      allEmotions.length === 0 ||
      new Date().getSeconds() - startTime.current === 0
    ) {
      return;
    }
    let newData = {
      Calmness: 0,
      Interest: 0,
      Boredom: 0,
      Joy: 0,
      time: new Date().getSeconds() - startTime.current,
    };
    for (let e of allEmotions) {
      if (["Calmness", "Interest", "Boredom", "Joy"].includes(e.name)) {
        console.log("pushing", e.name, e.score);
        newData[e.name] = e.score;
      }
    }
    setEmotionsMap([...emotionsMap, newData]);
  }, [allEmotions]);

  const startRecording = () => {
    startTime.current = new Date().getSeconds();
    setEmotionsMap([
      {
        Calmness: 0,
        Interest: 0,
        Boredom: 0,
        Joy: 0,
        time: 0,
      },
    ]);
    setData(null);
    setLoading(false);
    console.log("Starting recording");
    setCapturing(true);
    setShowEmotions(true);
    cap2.current = true;
    const stream = webcamRef.current.stream;
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      sendVideoToServer(blob);
    };

    mediaRecorderRef.current.start();
  };

  const stopRecording = () => {
    console.log("Stopping recording");
    endTime.current = new Date().getSeconds();
    setShowEmotions(false);
    setLoading(true);
    console.log(emotionsMap);

    chunks = [];
    mediaRecorderRef.current.stop();
    setCapturing(false);
    cap2.current = false;

    // Reset emotions
    setAllEmotions([]);
  };

  const videoConstraints = {
    facingMode: "user",
  };

  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  useEffect(() => {
    if (capturing) {
      capturePhoto();
      timerRef.current = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000); // Increment timer every second
    } else {
      clearInterval(timerRef.current);
      setTimer(0); // Reset timer when not capturing
    }

    return () => {
      clearInterval(timerRef.current);
    };
  }, [capturing]);

  const articulationData = () => {
    if (!data) {
      return [];
    }

    return data.articulationDatapoints.map((v, i) => {
      return { value: v, index: i };
    });
  };

  const barData = () => {
    console.log("data", data);
    if (!data) {
      return [];
    }
    const numFillers = data.fillerWords.length;
    const numPauses = data.totalNumberOfPauses;
    const numRepeats = data.repeats.length;
    const numStutter = data.stutter.length;

    return [
      {
        name: "Fillers",
        data: numFillers,
      },
      {
        name: "Pauses",
        data: numPauses,
      },
      {
        name: "Repeats",
        data: numRepeats,
      },
      {
        name: "Stutters",
        data: numStutter,
      },
    ];
  };

  return (
    <div className="flex flex-col md:flex-row justify-center p-4 md:p-8 space-y-4 md:space-y-0 md:space-x-10">
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-evenly bg-light shadow-md rounded-md py-8 px-8 ">
          <div className="flex space-x-1 items-center justify-between">
            {allEmotions.length > 0 ? (
              <h5 className="font-semibold">Top Emotions:</h5>
            ) : (
              <div></div>
            )}
            {allEmotions
              .sort((a, b) => b.score - a.score) // Sort in descending order based on score
              .slice(0, 3) // Keep only the top three emotions
              .map((e) => (
                <div
                  key={e.name}
                  className="bg-mid my-4 px-4 py-2 rounded-md flex space-x-4 justify-between items-center w-44"
                >
                  <p className="text-xs">{e.name}</p>
                  <p className="text-xs">{e.score.toFixed(2)}</p>
                </div>
              ))}
          </div>

          <div style={{ position: "relative" }}>
            {isScrubbable ? (
              <div className="flex justify-center mx-auto">
                <VideoPlayer
                  src={URL.createObjectURL(blob)}
                  duration={endTime.current - startTime.current}
                  startTimestamp={vidTime}
                />
              </div>
            ) : (
              <Webcam
                audio={true}
                muted={true}
                mirrored={true}
                ref={webcamRef}
                videoConstraints={videoConstraints}
                className="rounded-md shadow-md"
              />
            )}

            {capturing ? (
              <div
                className="bg-mid px-6 py-2 rounded-md md:text-base"
                style={{ position: "absolute", bottom: "5px", left: "10px" }}
              >
                Timer: {formatTime(timer)}
              </div>
            ) : (
              <div className="hidden"></div>
            )}
          </div>
          <div className="flex space-x-2 mt-4">
            {capturing ? (
              <button
                className="btn bg-dark text-sm md:text-base"
                onClick={stopRecording}
              >
                Stop
              </button>
            ) : (
              <>
                {!isScrubbable && (
                  <button
                    className="btn bg-mid text-sm md:text-base"
                    onClick={startRecording}
                  >
                    Practice Presenting
                  </button>
                )}
              </>
            )}
            {data && !isScrubbable ? (
              <button
                className="btn ml-2 bg-mid text-sm md:text-base"
                onClick={() => setIsScrubbable(!isScrubbable)}
              >
                Playback Recorded Video
              </button>
            ) : (
              <button
                className="btn ml-2 bg-mid text-sm md:text-base"
                onClick={() => setIsScrubbable(!isScrubbable)}
              >
                Practice Again
              </button>
            )}
          </div>
        </div>

        {data && isScrubbable ? (
          <div className="flex flex-col justify-evenly bg-light shadow-md rounded-md py-8 px-8 mt-4">
            <div className="flex flex-col text-left bg-light rounded-md">
              <h2 className="font-semibold text-lg">Places to improve</h2>
              {data.fillerWords.map((f) => (
                <button
                  key={f.time[0]}
                  className="btn bg-mid text-sm md:text-base flex w-64 justify-between mt-2"
                  onClick={() => {
                    if (f.time[0]) {
                      setVidTime(f.time[0]);
                      console.log("vidTime", vidTime);
                    }
                  }}
                >
                  <p>{f.word}</p>

                  <p>
                    {f.time[0].toFixed(2)}-{f.time[1].toFixed(2)}s
                  </p>
                </button>
              ))}
              {data.likes.map((f) => (
                <button
                  key={f.time[0]}
                  className="btn bg-mid text-sm md:text-base flex w-64 justify-between mt-2"
                  onClick={() => {
                    if (f.time[0]) {
                      setVidTime(f.time[0]);
                      console.log("vidTime", vidTime);
                    }
                  }}
                >
                  <p>{f.word}</p>
                  <p>
                    {f.time[0].toFixed(2)}-{f.time[1].toFixed(2)}s
                  </p>
                </button>
              ))}
              {data.stutter.map((f) => (
                <button
                  key={f.time[0]}
                  className="btn bg-mid text-sm md:text-base flex w-64 justify-between mt-2"
                  onClick={() => {
                    if (f.time[0]) {
                      setVidTime(f.time[0]);
                      console.log("vidTime", vidTime);
                    }
                  }}
                >
                  <p>{f.word}</p>
                  <p>
                    {f.time[0].toFixed(2)}-{f.time[1].toFixed(2)}s
                  </p>
                </button>
              ))}
              {data.articulationDatapoints.map(
                (f, i) =>
                  f <= 3 && (
                    <button
                      key={i}
                      className="btn bg-mid text-sm md:text-base flex w-64 justify-between mt-2"
                      onClick={() => {
                        if (f.time[0]) {
                          setVidTime(f.time[0]);
                          console.log("vidTime", vidTime);
                        }
                      }}
                    >
                      <p>Too Slow</p>
                      {/* <p>{f.time[0] - f.time[1]}s</p> */}
                    </button>
                  )
              )}
            </div>
          </div>
        ) : (
          <div></div>
        )}
      </div>
      {showEmotions || true ? (
        <div className="flex flex-col">
          {data ? (
            <div>
              <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md">
                <h1 className="font-semibold text-2xl">
                  Presentation Score: {data.FinalScore.toFixed(0)}
                </h1>
              </div>
              <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md mt-4 mb-4">
                <h2 className="font-semibold">
                  Eye contact score:{" "}
                  {100 - data.eyeContactPenalty.toFixed(2) * 100}
                </h2>
              </div>
            </div>
          ) : (
            <div className="hidden"></div>
          )}
          <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md">
            <h2 className="font-semibold">Emotions over time</h2>
            <AreaChart
              width={430}
              height={300}
              data={emotionsMap}
              margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorCalmness" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#83a6ed" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#83a6ed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBoredom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a4de6c" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#a4de6c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorJoy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={false}
                label={{ value: "Time", position: "insideBottom", dy: 10 }}
              />
              <YAxis
                label={{
                  value: "Presence",
                  position: "insideLeft",
                  angle: -90,
                  dy: 30,
                  dx: -10,
                }}
              />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(value) => value.toFixed(2)} />
              <Legend verticalAlign="top" height={36} />

              <Area
                type="monotone"
                animationDuration={500}
                isAnimationActive={false}
                dataKey="Calmness"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorCalmness)"
              />
              <Area
                type="monotone"
                animationDuration={500}
                isAnimationActive={false}
                dataKey="Interest"
                stroke="#83a6ed"
                fillOpacity={1}
                fill="url(#colorInterest)"
              />
              <Area
                type="monotone"
                animationDuration={500}
                isAnimationActive={false}
                dataKey="Boredom"
                stroke="#a4de6c"
                fillOpacity={1}
                fill="url(#colorBoredom)"
              />
              <Area
                type="monotone"
                animationDuration={500}
                isAnimationActive={false}
                dataKey="Joy"
                stroke="#82ca9d"
                fillOpacity={1}
                fill="url(#colorJoy)"
              />
            </AreaChart>
          </div>
          {data ? (
            <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md min-h-36 mt-4">
              <h2 className="font-semibold">Articulation</h2>
              <BarChart width={430} height={300} data={barData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                {/* <Legend /> */}
                <Bar dataKey="data" fill="#8884d8" />
              </BarChart>
            </div>
          ) : (
            <div></div>
          )}
          {data ? (
            <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md mt-4">
              <h2 className="font-semibold">Syllables per second</h2>
              <LineChart
                width={430}
                height={300}
                data={articulationData()}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip />
                {/* <Legend /> */}
                <Line type="monotone" dataKey="value" stroke="#82ca9d" />
              </LineChart>
            </div>
          ) : (
            <div></div>
          )}

          {capturing & !loading ? (
            <div className="flex flex-col text-left bg-light p-6 md:p-8 shadow-md rounded-md mt-4">
              <h2>Analyzing video and audio</h2>
            </div>
          ) : (
            <div></div>
          )}
          {loading ? (
            <div className="flex justify-center">
              <ReactLoading
                type="cylon"
                color="#8884d8"
                height={"50%"}
                width={"50%"}
              />
            </div>
          ) : (
            <div className="hidden"></div>
          )}
        </div>
      ) : (
        <div className="hidden"></div>
      )}
    </div>
  );
}
