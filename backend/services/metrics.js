const { spawn } = require("child_process");
const path = require("path");

function runPythonMetrics(csvPath) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "bias_engine.py");
        const proc = spawn("python3", [scriptPath, csvPath]);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `Python exited with code ${code}`));
            }
            try {
                const parsed = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (err) {
                reject(new Error("Failed to parse Python JSON output"));
            }
        });
    });
}

module.exports = { runPythonMetrics };