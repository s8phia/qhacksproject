"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  //file selection
  const fileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  //remove file
  const removeFile = () => {
    setFile(null);
  };

  //navigate to next page
  const confirmUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:3001/api/uploads/usertrades", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Upload failed: ${err?.error || "Unknown error"}`);
        return;
      }

      const data = await res.json();
      console.log("Metrics:", data);

      router.push("/select-person");

    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed");
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
            >
              x
            </button>
          </div>
        ) : (
          <span className="text-gray-500">No file selected</span>
        )}
      </div>
    </main>
  );
}