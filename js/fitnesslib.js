/**
 * ================================================================
 * File: [styles.css]
 * Author: Gunpreet Singh
 * Student ID: 9022194
 * Description: [Css file for the project]
 * ================================================================
 */
"use strict";
const FitnessLib = {
    workouts: [],
    goals: [],
  
    // Add workout
    addWorkout(type, duration, calories, date) {
      const workout = new Workout(type, duration, calories, date);
      this.workouts.push(workout);
      return this; 
    },
  
    //  Save
    save() {
      try {
        localStorage.setItem("workouts", JSON.stringify(this.workouts));
        return this;
      } catch (e) {
        throw new Error("Save failed");
      }
    },
  
    //  Workout plans
    getWorkoutPlan(level) {
      const plans = new Map([
        ["Beginner", "Run 20 min"],
        ["Intermediate", "Yoga 30 min"],
        ["Advanced", "Weights 45 min"]
      ]); 
      return plans.get(level) || "Rest day";
    }
  };
  
  