"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");   // 👈 same as simple page
  const router = useRouter();

  // file selection
  const fileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // remove file
  const removeFile = () => {
    setFile(null);
    setResult("");
  };

  // upload + then go to next page
  const confirmUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setResult("Uploading...");

    try {
      const res = await fetch("http://localhost:3001/api/uploads/usertrades", {
        method: "POST",
        body: formData,
      });

      let data: any = null;

      try {
        data = await res.json();
        setResult(JSON.stringify(data.metrics ?? {}, null, 2));
      } catch {
        setResult("Upload complete, but failed to parse metrics.");
        return;
      }

      // only move on if upload succeeded
      if (res.ok) {
        router.push("/select-person");
      }

    } catch (err: any) {
      console.error("Upload failed", err);
      setResult("Upload failed: " + err?.message);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute w-72 h-72 rounded-full bg-[#1e0237] blur-3xl opacity-40 top-[250px] left-[250px]"></div>
        <div className="absolute w-96 h-96 rounded-full bg-[#561557] blur-3xl opacity-40 top-[30px] left-[600px]"></div>
        <div className="absolute w-96 h-96 rounded-full bg-[#561557] blur-3xl opacity-40 top-[40px] left-[200px]"></div>
        <div className="absolute w-72 h-72 rounded-full bg-[#561557] blur-3xl opacity-30 top-[300px] left-[500px]"></div>
        <div className="absolute w-50 h-50 rounded-full bg-[#ffae51] blur-3xl opacity-50 top-[90px] left-[430px]"></div>
        <div className="absolute w-20 h-20 rounded-full bg-[#c0207b] blur-2xl opacity-20 top-[200px] left-[700px]"></div>
        <div className="absolute w-90 h-90 rounded-full bg-[#1e0237] blur-3xl opacity-60 top-[160px] left-[700px]"></div>
        <div className="absolute w-20 h-20 rounded-full bg-[#ffae51] blur-3xl opacity-50 top-[80px] left-[700px]"></div>
        <div className="absolute w-20 h-20 rounded-full bg-[#561557] blur-2xl opacity-60 top-[350px] left-[400px]"></div>
        <div className="absolute w-80 h-80 rounded-full bg-[#c0207b] blur-3xl opacity-50 top-[100px] left-[500px]"></div>
      </div>
      <div className="absolute inset-0 z-10 pointer-events-none opacity-10 mix-blend-overlay">
        <Image src="/noise_overlay.png" alt="Noise" fill className="object-cover" />
      </div>

      <main className="relative z-20 flex flex-col items-center justify-center h-full p-8">
        <h1 className="text-5xl font-fustat font-bold mb-4 drop-shadow-[0_0_15px_rgba(192,32,123,0.5)]">
          Welcome Message
        </h1>
        <h5 className="text-center font-fustat mb-8">
          Lorem ipsum dolor sit amet consectetur adipiscing elit.
        </h5>

        <div className="flex flex-col items-center gap-2">
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={fileChange}
            className="hidden"
          />

          <label
            htmlFor={!file ? "csv-upload" : undefined}
            onClick={file ? confirmUpload : undefined}
            className="px-6 py-3 bg-[#0c0810] font-bold text-white rounded-full cursor-pointer shadow-[0_0_20px_rgba(192,32,123,0.4)] hover:shadow-[0_0_30px_rgba(192,32,123,0.6)] hover:bg-[#1e0237] transition-all duration-300 ease-out hover:scale-105"
          >
            {file ? "Continue" : "Choose File"}
          </label>

          {/* File status */}
          {file ? (
            <div className="flex items-center gap-2 text-[#0c0810]">
              <span>{file.name}</span>
              <button
                onClick={removeFile}
                className="font-fustat font-bold cursor-pointer hover:text-white"
                aria-label="Remove file"
              >
                x
              </button>
            </div>
          ) : (
            <span className="text-[#0c0810]">No file selected</span>
          )}

          {/* 🔽 same debug output as your simple page */}
          {result && (
            <pre className="mt-4 text-xs bg-gray-100 p-3 rounded max-w-xl overflow-auto text-black">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}

        </div>
      </main>
    </div>



  );
}