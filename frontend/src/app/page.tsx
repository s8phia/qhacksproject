"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">
        Welcome Message
      </h1>
      <h5 className="text-center mb-4">
        Lorem ipsum dolor sit amet consectetur adipiscing elit.
      </h5>

      <div className="flex flex-col items-center gap-4">
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
          className="px-6 py-3 bg-black text-white rounded-lg cursor-pointer hover:bg-gray-800"
        >
          {file ? "Continue" : "Choose File"}
        </label>

        {/* File status */}
        {file ? (
          <div className="flex items-center gap-2 text-gray-700">
            <span>{file.name}</span>
            <button
              onClick={removeFile}
              className="font-bold hover:text-white"
              aria-label="Remove file"
              type="button"
            >
              x
            </button>
          </div>
        ) : (
          <span className="text-gray-500">No file selected</span>
        )}

        {/* 🔽 same debug output as your simple page */}
        {result && (
          <pre className="mt-4 text-xs bg-gray-100 p-3 rounded max-w-xl overflow-auto">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}