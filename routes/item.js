const express = require("express");
const Item = require("../models/Item");

const router = express.Router();

//create a setup
router.post("/",  async (req, res) => {
    const newItem = new Item(req.body);
  
    try {
      const savedItem = await newItem.save();
      res.status(200).json(savedItem);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

//update a setup
router.put("/:id", async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//delete a setup
router.delete("/:id", async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json("Item has been deleted!");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//get a setup
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

//get all setups
router.get("/", async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//get recommendations based on total wattage and hours of multiple items
router.post("/recommend", async (req, res) => {
  try {
    let { items } = req.body; // Expect an array of items with wattage, dayHours, nightHours
    
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return res.status(400).json({ message: "Items are required" });
    }

    // Convert single item to array if needed
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    // Validate input data
    for (const item of items) {
      if (!item.wattage || !item.dayHours || !item.nightHours) {
        return res.status(400).json({ message: "Each item must have wattage, dayHours, and nightHours" });
      }
    }

    // Calculate total wattage and hours
    const totalWattage = items.reduce((sum, item) => sum + Number(item.wattage), 0);
    const totalDayHours = items.reduce((sum, item) => sum + Number(item.dayHours), 0);
    const totalNightHours = items.reduce((sum, item) => sum + Number(item.nightHours), 0);
    const totalHours = totalDayHours + totalNightHours;

    const recommendations = [
      { 
        minWattage: totalWattage * 0.8, 
        maxWattage: totalWattage * 1.2, 
        minHours: totalHours * 0.8,
        maxHours: totalHours * 1.2,
        description: "Optimal Power Range",
        dailyConsumption: (totalWattage * totalHours).toFixed(2) + " Wh"
      },
      { 
        minWattage: totalWattage * 0.6, 
        maxWattage: totalWattage * 0.8, 
        minHours: totalHours * 0.6,
        maxHours: totalHours * 0.8,
        description: "Energy Saving Option",
        dailyConsumption: (totalWattage * totalHours * 0.7).toFixed(2) + " Wh"
      },
      { 
        minWattage: totalWattage * 1.2, 
        maxWattage: totalWattage * 1.4, 
        minHours: totalHours * 1.2,
        maxHours: totalHours * 1.4,
        description: "High Performance Option",
        dailyConsumption: (totalWattage * totalHours * 1.3).toFixed(2) + " Wh"
      }
    ];
    
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
      recommendedItems: recommendedItems
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; // Export the router