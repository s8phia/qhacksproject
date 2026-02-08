const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");


function resolvePythonExecutable() {
    if (process.env.PYTHON_PATH) {
        return process.env.PYTHON_PATH;
    }


    const projectRoot = path.join(__dirname, "..", "..");
    const venvPython = process.platform === "win32"
        ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
        : path.join(projectRoot, ".venv", "bin", "python");


    if (fs.existsSync(venvPython)) {
        return venvPython;
    }


    return process.platform === "win32" ? "python" : "python3";
}


function runPythonMetrics(csvPath) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "bias_engine.py");
        const pythonExec = resolvePythonExecutable();
        const proc = spawn(pythonExec, [scriptPath, csvPath]);


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
