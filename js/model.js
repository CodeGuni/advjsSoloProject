/**
 * ================================================================
 * File: model.js
 * Author: Gunpreet Singh
 * Student ID: 9022194
 * Description: Manages data structures, storage, and Fitbit API integration for the Fitness Tracker
 * ================================================================
 */
"use strict";

//  workout with formatted date 
class Workout {
  constructor(type, duration, calories, date) {
    this.type = type;
    this.duration = Number(duration); 
    this.calories = Number(calories).toFixed(2); 
    this.date = new Date(date); // Store as Date object
  }
  
  get formattedDate() {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(this.date);
  }
}

// Represents a fitness goal with type, target, and timeframe
class Goal {
  constructor(type, target, timeframe) {
    this.type = type;
    this.target = Math.max(0, Number(target)); 
    this.timeframe = timeframe; 
  }
}

const Model = {
  workouts: [], 
  goals: [], 
  fitbitAccessToken: null, // Current Fitbit access token
  fitbitRefreshToken: null, // Token for refreshing access
  fitbitTokenExpiry: null, // Expiry timestamp for access token
  weeklyFitbitData: [], // Cached weekly Fitbit data (calories, steps)
  lastFetchDate: null, // Date of last weekly Fitbit fetch
  CLIENT_ID: "23Q4KT", // Fitbit API client ID
  CLIENT_SECRET: "c14bd750de26dcd6e51b0c5d7b09badb", // Fitbit API client secret
  REDIRECT_URI: "http://localhost:3000/callback", //  redirect URI

  // Load  data from localStorage and convert to class instances
  loadData() {
    try {
      this.workouts = JSON.parse(localStorage.getItem("workouts")) || [];
      this.goals = JSON.parse(localStorage.getItem("goals")) || [];
      this.fitbitAccessToken = localStorage.getItem("fitbitAccessToken");
      this.fitbitRefreshToken = localStorage.getItem("fitbitRefreshToken");
      this.fitbitTokenExpiry = localStorage.getItem("fitbitTokenExpiry");
      this.weeklyFitbitData = JSON.parse(localStorage.getItem("weeklyFitbitData")) || [];
      this.lastFetchDate = localStorage.getItem("lastFetchDate");
      // Convert raw JSON objects to class instances
      this.workouts = this.workouts.map(w => new Workout(w.type, w.duration, w.calories, w.date));
      this.goals = this.goals.map(g => new Goal(g.type, g.target, g.timeframe));
      console.log("Loaded workouts:", this.workouts);
    } catch (e) {
      console.error("Load Error:", e.message);
      // Reset to defaults on parse failure
      this.workouts = [];
      this.goals = [];
      this.weeklyFitbitData = [];
    }
  },

  // Save a new workout 
  saveWorkout(workout) {
    try {
      this.workouts.push(workout);
      localStorage.setItem("workouts", JSON.stringify(this.workouts));
      console.log("Saved workout:", workout);
    } catch (e) {
      throw new Error("Failed to save workout");
    }
  },

  // Save a single goal and replaces existing goal
  saveGoal(goal) {
    try {
      this.goals = [goal]; 
      localStorage.setItem("goals", JSON.stringify(this.goals));
    } catch (e) {
      throw new Error("Failed to save goal");
    }
  },

  
  getUniqueTypes() {
    return new Set(this.workouts.map(w => w.type));
  },

  // Calculate current streak of workout days
  getStreak() {
    if (!this.workouts.length) return 0;
    
    const uniqueDays = [...new Set(this.workouts.map(w => {
      const d = new Date(w.date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }))].sort((a, b) => b - a); // Sort descending 
    if (!uniqueDays.length) return 0;
    let streak = 1;
    const oneDayMs = 24 * 60 * 60 * 1000; 
    // Check for consecutive days
    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = uniqueDays[i - 1] - uniqueDays[i];
      if (diff === oneDayMs) streak++;
      else break; 
    }
    console.log("Calculated streak:", streak);
    return streak;
  },

  // Initiate Fitbit OAuth flow by redirecting to authorization URL
  startFitbitAuth() {
    if (!this.CLIENT_ID || this.CLIENT_ID === "YOUR_CLIENT_ID") {
      console.error("Invalid Client ID. Update CLIENT_ID in model.js.");
      return;
    }
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${this.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&scope=activity%20profile`;
    console.log("Redirecting to Fitbit auth URL:", authUrl);
    window.location.href = authUrl;
  },

  // Exchange authorization code for Fitbit access and refresh tokens
  async getFitbitToken(code) {
    const tokenUrl = "https://api.fitbit.com/oauth2/token";
    const authString = `${this.CLIENT_ID}:${this.CLIENT_SECRET}`;
    const authHeader = `Basic ${btoa(authString)}`; 
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: this.REDIRECT_URI,
      code: code
    });
    try {
      console.log("Fetching Fitbit token with code:", code);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": authHeader
        },
        body: body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token fetch failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      this.fitbitAccessToken = data.access_token;
      this.fitbitRefreshToken = data.refresh_token;
      this.fitbitTokenExpiry = Date.now() + (data.expires_in * 1000); 
      // store tokens to localStorage
      localStorage.setItem("fitbitAccessToken", this.fitbitAccessToken);
      localStorage.setItem("fitbitRefreshToken", this.fitbitRefreshToken);
      localStorage.setItem("fitbitTokenExpiry", this.fitbitTokenExpiry.toString());
      console.log("Fitbit token received:", this.fitbitAccessToken);
      console.log("Refresh token received:", this.fitbitRefreshToken);
      console.log("Token expiry:", new Date(this.fitbitTokenExpiry));
      return true;
    } catch (e) {
      console.error("Token Fetch Error:", e.message);
      throw e;
    }
  },

  // Refresh Fitbit access token using the refresh token
  async refreshFitbitToken() {
    if (!this.fitbitRefreshToken) {
      console.error("No refresh token available. Please reauthorize Fitbit.");
      throw new Error("No refresh token available");
    }
    const tokenUrl = "https://api.fitbit.com/oauth2/token";
    const authString = `${this.CLIENT_ID}:${this.CLIENT_SECRET}`;
    const authHeader = `Basic ${btoa(authString)}`;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.fitbitRefreshToken
    });
    try {
      console.log("Refreshing Fitbit token...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": authHeader
        },
        body: body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      this.fitbitAccessToken = data.access_token;
      this.fitbitRefreshToken = data.refresh_token;
      this.fitbitTokenExpiry = Date.now() + (data.expires_in * 1000);
      // Update tokens
      localStorage.setItem("fitbitAccessToken", this.fitbitAccessToken);
      localStorage.setItem("fitbitRefreshToken", this.fitbitRefreshToken);
      localStorage.setItem("fitbitTokenExpiry", this.fitbitTokenExpiry.toString());
      console.log("Fitbit token refreshed:", this.fitbitAccessToken);
      console.log("New refresh token:", this.fitbitRefreshToken);
      console.log("New token expiry:", new Date(this.fitbitTokenExpiry));
      return true;
    } catch (e) {
      console.error("Token Refresh Error:", e.message);
      // Clear tokens on failure 
      this.fitbitAccessToken = null;
      this.fitbitRefreshToken = null;
      this.fitbitTokenExpiry = null;
      localStorage.removeItem("fitbitAccessToken");
      localStorage.removeItem("fitbitRefreshToken");
      localStorage.removeItem("fitbitTokenExpiry");
      throw e;
    }
  },

  // Fetch and merge today's Fitbit activity data into workouts
  async fetchFitbitData() {
    if (!this.fitbitAccessToken) {
      console.log("No Fitbit access token, skipping data fetch.");
      return this.workouts;
    }

    if (this.fitbitTokenExpiry && Date.now() > this.fitbitTokenExpiry) {
      console.log("Access token expired, attempting to refresh...");
      await this.refreshFitbitToken();
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; 
    console.log("Fetching Fitbit data for date:", todayStr);
    const url = `https://api.fitbit.com/1/user/-/activities/date/${todayStr}.json`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${this.fitbitAccessToken}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API fetch failed: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Fitbit today data:", data);
      const calories = data.summary.caloriesOut || 0;
      const duration = data.summary.activeDuration ? data.summary.activeDuration / 60000 : 0; 
      // Avoid duplicate entries for today
      const todayExists = this.workouts.some(w => w.date.toISOString().split("T")[0] === todayStr && w.type === "Activity");
      if (!todayExists) {
        const fitbitWorkout = new Workout("Activity", duration, calories, todayStr);
        this.workouts.push(fitbitWorkout);
        localStorage.setItem("workouts", JSON.stringify(this.workouts));
      }
      console.log("Workouts after Fitbit merge:", this.workouts);
      return this.workouts;
    } catch (e) {
      console.error("Fetch Error:", e.message);
      throw e;
    }
  },

  // Fetch  data for the past 7 days
  async fetchFitbitWeeklyData(forceRefresh = false) {
    if (!this.fitbitAccessToken) {
      console.log("No Fitbit access token, skipping weekly data fetch.");
      return [];
    }

    if (this.fitbitTokenExpiry && Date.now() > this.fitbitTokenExpiry) {
      console.log("Access token expired, attempting to refresh...");
      await this.refreshFitbitToken();
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    // Check if refresh is needed 
    const needsRefresh = forceRefresh || !this.lastFetchDate || this.lastFetchDate !== todayStr || this.weeklyFitbitData.length === 0;

    if (!needsRefresh) {
      console.log("Using cached Fitbit weekly data:", this.workouts);
      return this.weeklyFitbitData;
    }

    const weeklyData = [];
    const oneDayMs = 24 * 60 * 60 * 1000; 
    const now = new Date();
    now.setHours(0, 0, 0, 0); 

    // Fetch data for the past 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * oneDayMs);
      const dateStr = date.toISOString().split("T")[0];
      const url = `https://api.fitbit.com/1/user/-/activities/date/${dateStr}.json`;
      try {
        console.log(`Fetching Fitbit data for ${dateStr}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 
        const response = await fetch(url, {
          headers: { "Authorization": `Bearer ${this.fitbitAccessToken}` },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Weekly fetch failed for ${dateStr}: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`Raw Fitbit data for ${dateStr}:`, data);
        const calories = data.summary.caloriesOut || 0;
        const steps = data.summary.steps || 0;
        weeklyData.push({ date: dateStr, calories, steps });
      } catch (e) {
        console.error("Weekly Fetch Error:", e.message);
        // Push default data on failure to maintain array length
        weeklyData.push({ date: dateStr, calories: 0, steps: 0 });
      }
    }
    this.weeklyFitbitData = weeklyData;
    this.lastFetchDate = todayStr;
    // Cache weekly data and fetch date
    localStorage.setItem("weeklyFitbitData", JSON.stringify(this.weeklyFitbitData));
    localStorage.setItem("lastFetchDate", this.lastFetchDate);
    console.log("Fitbit weekly data cached:", this.weeklyFitbitData);
    return this.weeklyFitbitData;
  }
};