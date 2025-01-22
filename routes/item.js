const express = require("express");
const Item = require("../models/Item");

const router = express.Router();


//get recommendations based on total wattage and hours of multiple items
router.post("/recommend", async (req, res) => {
  try {
    let { items } = req.body; 
    
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return res.status(400).json({ message: "Items are required" });
    }

    // Convert single item to array if needed
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    // Validate input data
    for (const item of items) {
      if (!item.nameOfItem || !item.quantity || !item.wattage || !item.dayHours || !item.nightHours) {
        return res.status(400).json({ message: "Each item must have nameOfItem, quantity, wattage, dayHours, and nightHours" });
      }
    }

    // Calculate total wattage and hours considering quantity
    const totalWattage = items.reduce((sum, item) => sum + (Number(item.wattage) * Number(item.quantity)), 0);
    const totalDayHours = items.reduce((sum, item) => sum + Number(item.dayHours), 0);
    const totalNightHours = items.reduce((sum, item) => sum + Number(item.nightHours), 0);
    const totalHours = totalDayHours + totalNightHours;

    // Store usage data in database
    const usage = new Item({
      nameOfItem: items[0].nameOfItem,
      quantity: items.reduce((sum, item) => sum + Number(item.quantity), 0),
      wattage: totalWattage,
      dayHours: totalDayHours,
      nightHours: totalNightHours
    });
    await usage.save();
    

    let recommendations = [];

    if (totalHours >= 1 && totalHours <= 5 && totalWattage >= 100 && totalWattage <= 200) {
      recommendations.push({
        minWattage: 100,
        maxWattage: 200,
        minHours: 1,
        maxHours: 5,
        description: "Low Usage Range",
        dailyConsumption: (totalWattage * totalHours).toFixed(2) + " Wh"
      });
    }

    if (totalHours >= 6 && totalHours <= 10 && totalWattage >= 201 && totalWattage <= 300) {
      recommendations.push({
        minWattage: 201,
        maxWattage: 300,
        minHours: 6,
        maxHours: 10,
        description: "Medium Usage Range",
        dailyConsumption: (totalWattage * totalHours).toFixed(2) + " Wh"
      });
    }

    if (totalHours >= 11 && totalHours <= 15 && totalWattage >= 301 && totalWattage <= 400) {
      recommendations.push({
        minWattage: 301,
        maxWattage: 400,
        minHours: 11,
        maxHours: 15,
        description: "High Usage Range",
        dailyConsumption: (totalWattage * totalHours).toFixed(2) + " Wh"
      });
    }

    if (totalHours >= 16 && totalHours <= 20 && totalWattage >= 401 && totalWattage <= 500) {
      recommendations.push({
        minWattage: 401,
        maxWattage: 500,
        minHours: 16,
        maxHours: 20,
        description: "Very High Usage Range",
        dailyConsumption: (totalWattage * totalHours).toFixed(2) + " Wh"
      });
    }
    
    
    const recommendedItems = await Item.find({
      $or: recommendations.map(rec => ({
        $and: [
          { wattage: { $gte: rec.minWattage, $lte: rec.maxWattage } },
          { totalHours: { $gte: rec.minHours, $lte: rec.maxHours } }
        ]
      }))
    }).sort({ wattage: 1 });
    
    const result = {
      totalWattage,
      totalHours,
      recommendations: recommendations,
      recommendedItems: recommendedItems,
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; // Export the router