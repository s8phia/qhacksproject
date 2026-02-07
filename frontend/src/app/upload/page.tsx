"use client";

import { useState } from "react";

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<string>("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setResult("Uploading...");

        try {
        const res = await fetch("http://localhost:3001/api/uploads/wealthsimple", {
            method: "POST",
            body: formData
        });

        const text = await res.text();
        try {
            const obj = JSON.parse(text);
            setResult(obj.output ?? "Upload complete");
        } catch {
            setResult(text);
        }

        } catch (err: any) {
        setResult("Upload failed: " + err?.message);
        }
    };

    return (
        <main style={{ padding: 24 }}>
        <h2>Upload Wealthsimple CSV</h2>

        <form onSubmit={handleSubmit}>
            <input
            type="file"
            accept=".csv"
            onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                setFile(e.target.files[0]);
                }
            }}
            />

            <br />

            <button type="submit">Upload</button>
        </form>

        <pre style={{ marginTop: 16 }}>{result}</pre>
        </main>
    );
}
