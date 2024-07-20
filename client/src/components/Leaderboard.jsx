import React, { useEffect, useState } from "react";
import axios from "axios";
import ReactLoading from "react-loading";

export default function Leaderboard() {
    const [data, setData] = useState(null);
    
    useEffect(() => {
        axios.get(`http://localhost:3000/getleaderboard`)
             .then(res => {
                 console.log("Leaderboard data", res.data);
                 setData(res.data);
             });
    }, []);
    
    if (!data) {
        return (
            <div className="flex justify-center items-center h-screen">
                <ReactLoading type="cylon" color="#8884d8" height={"20%"} width={"20%"} />
            </div>
        );
    }
    
    return (
        <div className="flex justify-center p-4">
            <div className="w-full max-w-2xl">
                <h1 className="text-3xl font-bold text-center mb-4">Leaderboard</h1>
                <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                    <table className="table-auto w-full">
                        <thead>
                            <tr className="bg-mid text-gray-600 uppercase text-sm leading-normal">
                                <th className="py-3 px-6 text-left">Rank</th>
                                <th className="py-3 px-6 text-left">User</th>
                                <th className="py-3 px-6 text-center">Score</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-600 text-sm font-light">
                            {data.map((user, index) => (
                                <tr className="border-b border-gray-200 hover:bg-gray-100" key={index}>
                                    <td className="py-3 px-6 text-left whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className="font-medium">{index + 1}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-6 text-left">
                                        <div className="flex items-center">
                                            <span>{user.user_id}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                        {user.score}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
