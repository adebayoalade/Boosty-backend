const express = require("express");
const Item = require("../models/Item");

const router = express.Router();

// Get all items from database
router.get("/", async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single item by ID
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Update item by ID
router.put("/:id", async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete item by ID
router.delete("/:id", async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//get recommendations based on total wattage and hours of multiple items
router.post("/recommend", async (req, res) => {
  try {
    let { items } = req.body; 
    
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return res.status(400).json({ message: "Items are required" });
    }

    // Convert single item to array
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    // Validate input data
    for (const item of items) {
      if (!item.nameOfItem || !item.quantity || !item.wattage || !item.dayHours || !item.nightHours) {
        return res.status(400).json({ message: "Each item must have nameOfItem, quantity, wattage, dayHours, and nightHours" });
      }
    }

    // Calculate total wattage
    const totalWattage = items.reduce((sum, item) => sum + Number(item.wattage), 0);
    const totalDayHours = items.reduce((sum, item) => sum + Number(item.dayHours), 0);
    const totalNightHours = items.reduce((sum, item) => sum + Number(item.nightHours), 0);

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

    if (totalWattage >= 0 && totalWattage <= 3125) {
      recommendations.push({
        panel: "monocrystaline solar penel",
        generator: "pure sine wave solar generator",
        battery: "lithium battery",
        amount: 2590000,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    }

    if (totalWattage >= 3126 && totalWattage <= 3750) {
      recommendations.push({
        panel: "monocrystaline solar panel",
        inverter: "pure sine wave hybrid inverter",
        battery: "lithium battery",
        amount: 4460000,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    }

    if (totalWattage >= 3751 && totalWattage <= 6250) {
      recommendations.push({
        panel: "monocrystaline solar panel",
        inverter: "pure sine wave hybrid inverter",
        battery: "lithium battery",
        amount: 5150000,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      },
      {
        panel: "monocrystaline solar panel",
        inverter: "pure sine wave hybrid inverter",
        battery: "lithium battery",
        amount: 7955000,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh" 
      }
    );
    }

    if (totalWattage >= 6251 && totalWattage <= 12500) {
      recommendations.push({
        panel: "monocrystaline solar panel",
        inverter: "pure sine wave hybrid inverter",
        battery: "lithium battery",
        amount: 11650000,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    }
    
    
    const recommendedItems = await Item.find({
      $or: recommendations.map(rec => ({
        wattage: { $gte: rec.minWattage, $lte: rec.maxWattage }
      }))
    }).sort({ wattage: 1 });
    
    const result = {
      totalWattage,
      recommendations: recommendations,
      recommendedItems: recommendedItems,
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; // Export the router