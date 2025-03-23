/**
 * ================================================================
 * File: server.js
 * Author: Gunpreet Singh
 * Student ID: 9022194
 * Description: Express server to serve static files and handle Fitbit OAuth callback
 * ================================================================
 */
"use strict";
const express = require('express');
const app = express();
const port = 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Handle Fitbit OAuth callback
app.get('/callback', (req, res) => {
  const code = req.query.code;
  res.send(`
    <script>
      localStorage.setItem("fitbitAuthCode", "${code}");
      window.location.href = "/index.html";
    </script>
  `);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});