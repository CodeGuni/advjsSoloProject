/**
 * ================================================================
 * File: controller.js
 * Author: Gunpreet Singh
 * Student ID: 9022194
 * Description: Handles application logic and user interactions for the Fitness Tracker
 * ================================================================
 */
"use strict";

const Controller = {
  async initDashboard() {
    try {
      if (typeof View.showLoading === "function") View.showLoading();
      else console.warn("View.showLoading is not available");

      Model.loadData();
      View.renderGreeting();
      let workouts = Model.workouts;
      let weeklyFitbitData = [];

      // Check Fitbit connection status
      if (!Model.fitbitAccessToken) {
        $("#fitbitMessage").text("Not connected");
        $("#connectFitbitBtn")
          .off("click")
          .on("click", () => {
            console.log("Connect Fitbit button clicked");
            Model.startFitbitAuth();
          });
        const authCode = localStorage.getItem("fitbitAuthCode");
        if (authCode) {
          console.log("Found Fitbit auth code, attempting to get token...");
          const success = await Model.getFitbitToken(authCode);
          if (success) {
            // Clean up auth code after successful token retrieval
            localStorage.removeItem("fitbitAuthCode");
            $("#fitbitMessage").text("Connected to Fitbit");
            $("#connectFitbitBtn").hide();
            console.log("Fetching Fitbit data after successful token...");
            workouts = await Model.fetchFitbitData();
            weeklyFitbitData = await Model.fetchFitbitWeeklyData(true);
          } else {
            $("#fitbitMessage").text("Connection failed. Try again.");
            console.error("Fitbit token fetch failed.");
          }
        } else {
          console.log("No Fitbit auth code found, skipping token fetch.");
        }
      } else {
        // Fitbit is already connected
        $("#fitbitMessage").text("Connected to Fitbit");
        $("#connectFitbitBtn").hide();
        console.log("Fitbit already connected, fetching data...");
        try {
          workouts = await Model.fetchFitbitData();
          weeklyFitbitData = await Model.fetchFitbitWeeklyData();
        } catch (e) {
          // Handle token expiration
          if (
            e.message.includes("No refresh token available") ||
            e.message.includes("Token refresh failed")
          ) {
            $("#fitbitMessage").text(
              "Fitbit authorization expired. Please reconnect."
            );
            $("#connectFitbitBtn").show();
            // Clear stored Fitbit credentials
            localStorage.removeItem("fitbitAccessToken");
            localStorage.removeItem("fitbitRefreshToken");
            localStorage.removeItem("fitbitTokenExpiry");
            Model.fitbitAccessToken = null;
            Model.fitbitRefreshToken = null;
            Model.fitbitTokenExpiry = null;
          }
          throw e; // Re-throw to handle in outer catch block
        }
      }

      console.log("Updating dashboard with data...");
      await this.updateDashboardWithFitbit(workouts, weeklyFitbitData);
    } catch (error) {
      // Log and display error
      console.error("Error in initDashboard:", error);
      if (
        !$("#fitbitMessage").text().includes("Fitbit authorization expired")
      ) {
        $("#fitbitMessage").text(
          "Error loading Fitbit data. Please try again."
        );
      }
    } finally {
      if (typeof View.hideLoading === "function") {
        View.hideLoading();
        console.log("Spinner hidden in finally block.");
      } else {
        console.warn("View.hideLoading is not available");
      }
    }
  },

  async updateDashboardWithFitbit(workouts, weeklyFitbitData) {
    // Calculate total calories from all workouts
    const totalCalories = workouts.reduce(
      (acc, w) => acc + Number(w.calories),
      0
    );
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weeklyWorkouts = workouts.filter((w) => w.date >= sevenDaysAgo);

    // Aggregate calories by day for the past week
    const dailyCalories = {};
    weeklyWorkouts.forEach((w) => {
      const dayKey = w.date.toISOString().split("T")[0];
      dailyCalories[dayKey] = (dailyCalories[dayKey] || 0) + Number(w.calories);
    });
    const weeklyAvg =
      Object.values(dailyCalories).reduce((acc, val) => acc + val, 0) / 7 || 0;

    const streak = Model.getStreak();
    const goal = Model.goals[0] || { target: 1000, type: "calories" }; // Default goal if none set
    const goalProgress = Math.min(100, (totalCalories / goal.target) * 100);

    // Render stats and charts
    View.renderStats(
      totalCalories,
      weeklyAvg,
      streak,
      goalProgress,
      totalCalories,
      goal.target
    );
    View.renderChart(workouts);

    // Render Fitbit-specific charts if connected and data is available
    if (Model.fitbitAccessToken && weeklyFitbitData.length > 0) {
      console.log("Weekly Fitbit data passed to charts:", weeklyFitbitData);
      View.renderFitbitWeeklyChart(weeklyFitbitData);
      View.renderFitbitWeeklyStepsChart(weeklyFitbitData);
    }

    View.renderQuote();
  },

  initLog() {
    Model.loadData();
    View.renderRecentWorkouts(Model.workouts);

    $("#addWorkoutBtn").on("click", () => View.showModal("workoutModal"));
    $(".close").on("click", () => View.hideModal("workoutModal"));

    // Handle workout form submission
    $("#workoutForm").on("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const type = formData.get("type");
      const duration = formData.get("duration");
      const calories = formData.get("calories");
      const date = formData.get("date");
      const numRegex = /^\d+$/;

      // Validate numeric inputs
      if (!numRegex.test(duration) || !numRegex.test(calories)) {
        alert("Duration and calories must be numbers");
        return;
      }
      try {
        if (isNaN(duration) || isNaN(calories))
          throw new RangeError("Invalid input");
        const workout = new Workout(type, duration, calories, date);
        Model.saveWorkout(workout);
        View.hideModal("workoutModal");
        View.renderRecentWorkouts(Model.workouts);
        alert("Workout saved!");
        location.href = "index.html";
      } catch (e) {
        alert(`Error: ${e.message}`);
      }
    });

    let timerInterval = null;
    let secondsElapsed = 0;

    // Start workout timer
    $("#startTimerBtn").on("click", () => {
      if (timerInterval) return;
      $("#startTimerBtn").addClass("hidden");
      $("#timerDisplay").removeClass("hidden").addClass("active");
      $("#stopTimerBtn").removeClass("hidden");
      secondsElapsed = 0;

      timerInterval = setInterval(() => {
        secondsElapsed++;
        const hours = Math.floor(secondsElapsed / 3600);
        const minutes = Math.floor((secondsElapsed % 3600) / 60);
        const seconds = secondsElapsed % 60;
        const displayTime = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        $("#timerDisplay").text(displayTime);
        console.log(
          `Timer tick: secondsElapsed=${secondsElapsed}, displayTime=${displayTime}`
        );
      }, 1000);
    });

    // Stop timer and save workout
    $("#stopTimerBtn").on("click", () => {
      if (!timerInterval) return;
      clearInterval(timerInterval);
      timerInterval = null;

      const displayTime = $("#timerDisplay").text();
      console.log(
        `Timer stopped: secondsElapsed=${secondsElapsed}, displayTime=${displayTime}`
      );

      const durationInMinutes = secondsElapsed / 60;
      const durationInMinutesDisplay = durationInMinutes.toFixed(2);
      const calories = secondsElapsed;
      const today = new Date().toISOString().split("T")[0];
      const workout = new Workout("Timer", durationInMinutes, calories, today);

      Model.saveWorkout(workout);
      View.renderRecentWorkouts(Model.workouts);
      alert(
        `Timer workout saved! Duration: ${durationInMinutesDisplay} min (${secondsElapsed} sec), Calories: ${calories}`
      );

      $("#stopTimerBtn").addClass("hidden");
      $("#timerDisplay")
        .removeClass("active")
        .addClass("hidden")
        .text("00:00:00");
      $("#startTimerBtn").removeClass("hidden");
      location.href = "index.html";
    });
  },

  initGoals() {
    Model.loadData();
    const workouts = Model.workouts;
    const fitbitData = Model.fitbitAccessToken ? Model.weeklyFitbitData : [];
    View.renderCurrentGoal(Model.goals, workouts, fitbitData);

    $("#addGoalBtn").on("click", () => View.showModal("goalModal"));
    $(".close").on("click", () => View.hideModal("goalModal"));

    // Handle goal form submission
    $("#goalForm").on("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const type = formData.get("type");
      const target = formData.get("target");
      const timeframe = formData.get("timeframe");
      try {
        if (isNaN(target)) throw new RangeError("Target must be a number");
        const goal = new Goal(type, target, timeframe);
        Model.saveGoal(goal);
        View.hideModal("goalModal");
        View.renderCurrentGoal(Model.goals, Model.workouts, fitbitData);
        alert("Goal set!");
        location.href = "index.html";
      } catch (e) {
        alert(`Error: ${e.message}`);
      }
    });
  },
};
