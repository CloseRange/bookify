#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const path = require("path");

const serverPath = path.join(__dirname, "src", "publishing_studio", "server.js");

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  cwd: __dirname,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`publishing_studio server stopped by signal: ${signal}`);
    process.exit(1);
  }
  process.exit(code || 0);
});

child.on("error", (error) => {
  console.error(`Failed to start publishing_studio server: ${error.message}`);
  process.exit(1);
});
