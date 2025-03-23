/**
 * ================================================================
 * File: view.js
 * Author: Gunpreet Singh
 * Student ID: 9022194
 * Description: Renders dynamic content and updates the UI for the Fitness Tracker
 * ================================================================
 */
"use strict";

const View = {
  // Display a time-based greeting to the user
  renderGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    $("#greeting").text(`${greeting}, Fitness Star!`); // Personalized greeting
  },

  // Update dashboard stats with calculated values
  renderStats(totalCalories, weeklyAvg, streak, goalProgress, completed, target) {
    $("#totalCalories").text(totalCalories.toFixed(2)); 
    $("#weeklyAvg").text(weeklyAvg.toFixed(2)); 
    $("#streak").text(streak); 
    $("#goalProgress").val(goalProgress); 
    $("#goalProgressText").text(`${completed.toFixed(2)} / ${target} (${goalProgress.toFixed(0)}%)`); 
  },

  // chart of calories burned over the past 7 days
  renderChart(workouts) {
    console.log("Workouts passed to renderChart:", workouts); // debugging

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6); 
    const days = [];
    const caloriesByDay = {};

    // Generate labels calorie data for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dayName = date.toLocaleString("en-US", { weekday: "short" });
      days.push(dayName);
      const dateKey = date.toISOString().split("T")[0]; 
      caloriesByDay[dateKey] = 0; 
    }

    //  calories from all workouts within the 7-day range
    workouts.forEach(w => {
      const workoutDate = new Date(w.date);
      const dateKey = workoutDate.toISOString().split("T")[0];
      if (caloriesByDay[dateKey] !== undefined) { 
        const calories = Number(w.calories) || 0;
        caloriesByDay[dateKey] += calories;
        console.log(`Adding ${calories} calories from workout on ${dateKey} (type: ${w.type})`);
      }
    });

    // Map  calories to the 7-day range
    const dailyCalories = days.map((_, i) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      return caloriesByDay[dateKey];
    });

    console.log("Calories chart data:", { days, dailyCalories });

    //update the chart using Chart.js
    const ctx = document.getElementById("calorieChart").getContext("2d");
    if (ctx) {
      if (window.calorieChart instanceof Chart) {
        window.calorieChart.destroy(); // Destroy existing chart 
      }
      window.calorieChart = new Chart(ctx, {
        type: "bar",
        data: { labels: days, datasets: [{ label: "Calories Burned", data: dailyCalories, backgroundColor: "#ff5733" }] },
        options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } } 
      });
    }
  },

  //  bar chart of Fitbit weekly calorie data
  renderFitbitWeeklyChart(weeklyData) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const days = [];
    const dateKeys = [];

    //  labels and date keys for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dayName = date.toLocaleString("en-US", { weekday: "short" });
      days.push(dayName);
      const dateKey = date.toISOString().split("T")[0];
      dateKeys.push(dateKey);
    }

    // Map Fitbit calorie data to the 7-day range
    const calories = dateKeys.map(dateKey => {
      const dayData = weeklyData.find(d => d.date === dateKey);
      return dayData ? dayData.calories : 0; 
    });

    console.log("Fitbit weekly chart data:", { days, dateKeys, calories });

    //  update the Fitbit calorie chart
    const ctx = document.getElementById("fitbitWeeklyChart").getContext("2d");
    if (ctx) {
      if (window.fitbitWeeklyChart instanceof Chart) {
        window.fitbitWeeklyChart.destroy();
      }
      window.fitbitWeeklyChart = new Chart(ctx, {
        type: "bar",
        data: { labels: days, datasets: [{ label: "Fitbit Weekly Calories", data: calories, backgroundColor: "#33cc33" }] },
        options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
      });
    }
  },

  //  bar chart of weekly step data
  renderFitbitWeeklyStepsChart(weeklyData) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const days = [];
    const dateKeys = [];

   
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dayName = date.toLocaleString("en-US", { weekday: "short" });
      days.push(dayName);
      const dateKey = date.toISOString().split("T")[0];
      dateKeys.push(dateKey);
    }

    
    const steps = dateKeys.map(dateKey => {
      const dayData = weeklyData.find(d => d.date === dateKey);
      return dayData ? dayData.steps : 0; 
    });

    console.log("Fitbit steps chart data:", { days, dateKeys, steps });

    // update the steps chart
    const ctx = document.getElementById("fitbitWeeklyStepsChart").getContext("2d");
    if (ctx) {
      if (window.fitbitWeeklyStepsChart instanceof Chart) {
        window.fitbitWeeklyStepsChart.destroy();
      }
      window.fitbitWeeklyStepsChart = new Chart(ctx, {
        type: "bar",
        data: { labels: days, datasets: [{ label: "Fitbit Weekly Steps", data: steps, backgroundColor: "#3366cc" }] },
        options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true } } }
      });
    }
  },

  // Display  quote
  renderQuote() {
    const quotes = ["Keep pushing!", "You’re stronger than you think!", "Every step counts!"];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    $("#quote").text(randomQuote);
  },

  // Display the 5 most recent workouts in a list
  renderRecentWorkouts(workouts) {
    const workoutList = $("#workoutList");
    workoutList.empty(); 
    if (workouts.length === 0) {
      workoutList.append("<li>No workouts logged yet.</li>");
    } else {
      const recent = workouts.slice(-5).reverse(); 
      recent.forEach(w => {
        const li = `<li>${w.type} - ${w.calories} cal on ${w.formattedDate}</li>`;
        workoutList.append(li);
      });
    }
  },

  //  current goal with progress 
  renderCurrentGoal(goals, workouts, fitbitData) {
    console.log("Rendering current goal with:", { goals, workouts, fitbitData });
    if (goals.length === 0) {
      $("#goalText").text("No goal set yet.");
      $("#goalProgressBar").val(0);
      $("#goalProgressText").text("0%");
      return;
    }
    const goal = goals[0]; 
    let progress = 0;
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    if (goal.type === "calories") {
      let totalCalories = 0;
      if (goal.timeframe === "daily") {
        // Calculate calories for today only
        totalCalories = workouts
          .filter(w => w.date.toISOString().split("T")[0] === today)
          .reduce((acc, w) => acc + Number(w.calories), 0);
      } else {
        // Calculate calories for the past 7 days
        totalCalories = workouts
          .filter(w => w.date >= sevenDaysAgo)
          .reduce((acc, w) => acc + Number(w.calories), 0);
      }
      progress = Math.min(100, (totalCalories / goal.target) * 100); 
      $("#goalText").text(`${goal.type}: ${totalCalories.toFixed(0)} / ${goal.target} (${goal.timeframe})`);
      $("#goalProgressBar").val(progress);
      $("#goalProgressText").text(`${progress.toFixed(0)}%`);
    } else if (goal.type === "steps") {
      let totalSteps = 0;
      if (fitbitData.length > 0) {
        if (goal.timeframe === "daily") {
          
          totalSteps = fitbitData
            .filter(d => d.date === today)
            .reduce((acc, d) => acc + Number(d.steps), 0);
        } else {
          
          totalSteps = fitbitData
            .filter(d => new Date(d.date) >= sevenDaysAgo)
            .reduce((acc, d) => acc + Number(d.steps), 0);
        }
      }
      progress = Math.min(100, (totalSteps / goal.target) * 100);
      
      $("#goalText").text(`${goal.type}: ${totalSteps} / ${goal.target} (${goal.timeframe}${fitbitData.length === 0 ? " - Fitbit required" : ""})`);
      $("#goalProgressBar").val(progress);
      $("#goalProgressText").text(`${progress.toFixed(0)}%`);
    }
  },

 
  showModal(modalId) { $(`#${modalId}`).fadeIn(300); },

  
  hideModal(modalId) { $(`#${modalId}`).fadeOut(300); },

  // Display loading spinner 
  showLoading() {
    const $loading = $("#loading");
    if ($loading.length) {
      $loading.removeClass("hidden");
      console.log("Spinner shown, classList:", $loading[0].classList.toString());
    } else {
      console.warn("Loading element not found!");
    }
  },

 
  hideLoading() {
    const $loading = $("#loading");
    if ($loading.length) {
      $loading.addClass("hidden");
      $loading.css("display", "none"); 
      console.log("Spinner hidden, classList:", $loading[0].classList.toString());
      console.log("Spinner display style:", $loading.css("display"));
    } else {
      console.warn("Loading element not found!");
    }
  }
};