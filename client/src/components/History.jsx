import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import ReactLoading from "react-loading";
import VideoPlayer from "./VideoPlayer";
import { AreaChart, XAxis, YAxis, Area, Tooltip } from "recharts";

export default function History() {
    const { user } = useAuth0();
    const [data, setData] = useState(null);
    const [video, setVideo] = useState(null);
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
        if (user) {
            axios.get(`http://localhost:3000/getscores/${user.email}`)
                 .then(res => {
                     console.log("History data", res.data);
                     setData(res.data);
                 });
        }
    }, [user]);

    const handleClick = (event) => {
        if (event) {
            const videoId = event.activePayload[0].payload.video_id;
            fetchVideo(videoId);
            fetchMetadata(videoId);
        }
    };

    const fetchVideo = (videoId) => {
        axios.get(`http://localhost:3000/getvideo/${videoId}`, { responseType: 'blob' })
             .then(res => setVideo(URL.createObjectURL(res.data)));
    };

    const fetchMetadata = (videoId) => {
        axios.get(`http://localhost:3000/getdata/${videoId}`)
             .then(res => setMetadata(res.data));
    };

    if (!user || !data) {
        return (
            <div className="flex justify-center items-center h-screen">
                <ReactLoading type="cylon" color="#8884d8" height={"50%"} width={"50%"} />
            </div>
        );
    }

    const processedData = data.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp).toDateString(),
        score: Math.max(e.score, 0)
    }));

    return (
        <div className="history-container flex flex-col items-center mt-10 bg-white shadow-md" style={{marginInline: "200px"}}>
          <h1 className="font-semibold">History</h1>
            <AreaChart
                width={1000}
                height={300}
                data={processedData}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                onClick={handleClick}
            >
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Area activeDot={{ r: 10 }} dataKey="score" stroke="#8884d8" fill="#8884d8" />
                <Tooltip />
            </AreaChart>
            {video && <VideoPlayer src={video} startTimestamp={0} />}
        </div>
    );
}
