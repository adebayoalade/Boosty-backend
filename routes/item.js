const express = require("express");
const Item = require("../models/Item");
const { verifyTokenAndAdmin } = require("../middleware/verifyToken");

const router = express.Router();

// Update item by ID
router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
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
router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
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


// Get all items from database
router.get("/", verifyTokenAndAdmin, async(req, res) => {
    const query = req.query.new;
 try {
    const items = query?
    await Item.find().sort({_id: -1 }).limit(5)
    : await Item.find();

    res.status(200).json(items);
 } catch (error) {
    res.status(500).json(error);
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
        panel: " 450w monocrystaline solar penel",
        panelQuantity: 4,
        panelImage: "https://images.pexels.com/photos/159243/solar-solar-cells-photovoltaic-environmentally-friendly-159243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
        generator: " 2.5kva pure sine wave solar generator",
        generatorImage: "https://media.istockphoto.com/id/1352803381/photo/solar-panel-inverter.jpg?b=1&s=612x612&w=0&k=20&c=Hyltw_GouBpRsROeOZdxyNSr6Lzeo6eyeppYfXMLTmY=",
        generatorQuantity: 1,
        generatorWarranty: "2 years warranty",
        battery: " 2.56kw lithium battery",
        batteryQuantity: 1,
        batteryImage: "https://media.istockphoto.com/id/1620576275/photo/close-up-view-of-home-battery-storage-system-on-building-facade.jpg?b=1&s=612x612&w=0&k=20&c=L5C8M4hfXLt_OscTaK_KnhY_GHXrIGGVvkMB3D6KS04=",
        batteryWarranty: "10 years warranty",
        amount: 3108000,
        vat: 233100,
        totalAmount: 3341100,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    }

    if (totalWattage >= 3126 && totalWattage <= 3750) {
      recommendations.push({
        panel: " 450w monocrystaline solar penel",
        panelQuantity: 8,
        panelImage: "https://images.pexels.com/photos/159243/solar-solar-cells-photovoltaic-environmentally-friendly-159243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
        inverter: " 3kva pure sine wave hybrid inverter",
        inverterImage: "https://media.istockphoto.com/id/1352803381/photo/solar-panel-inverter.jpg?b=1&s=612x612&w=0&k=20&c=Hyltw_GouBpRsROeOZdxyNSr6Lzeo6eyeppYfXMLTmY=",
        inverterQuantity: 1,
        inverterWarranty: "2 years warranty",
        battery: " 5kw lithium battery",
        batteryQuantity: 1,
        batteryImage: "https://media.istockphoto.com/id/1620576275/photo/close-up-view-of-home-battery-storage-system-on-building-facade.jpg?b=1&s=612x612&w=0&k=20&c=L5C8M4hfXLt_OscTaK_KnhY_GHXrIGGVvkMB3D6KS04=",
        batteryWarranty: "10 years warranty",
        amount: 5352000,
        vat: 401400,
        totalAmount: 5753400,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    }

    if (totalWattage >= 3751 && totalWattage <= 6250) {
      recommendations.push({
        panel: " 450w monocrystaline solar penel",
        panelQuantity: 10,
        panelImage: "https://images.pexels.com/photos/159243/solar-solar-cells-photovoltaic-environmentally-friendly-159243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
        inverter: " 5kva pure sine wave hybrid inverter",
        inverterImage: "https://media.istockphoto.com/id/1352803381/photo/solar-panel-inverter.jpg?b=1&s=612x612&w=0&k=20&c=Hyltw_GouBpRsROeOZdxyNSr6Lzeo6eyeppYfXMLTmY=",
        inverterQuantity: 1,
        inverterWarranty: "2 years warranty",
        battery: " 5kw lithium battery",
        batteryQuantity: 1,
        batteryImage: "https://media.istockphoto.com/id/1620576275/photo/close-up-view-of-home-battery-storage-system-on-building-facade.jpg?b=1&s=612x612&w=0&k=20&c=L5C8M4hfXLt_OscTaK_KnhY_GHXrIGGVvkMB3D6KS04=",
        batteryWarranty: "10 years warranty",
        amount: 6180000,
        vat: 463500,
        totalAmount: 6643500,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      },
      {
        panel: " 450w monocrystaline solar penel",
        panelQuantity: 15,
        panelImage: "https://images.pexels.com/photos/159243/solar-solar-cells-photovoltaic-environmentally-friendly-159243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
        inverter: " 5kva pure sine wave hybrid inverter",
        inverterImage: "https://media.istockphoto.com/id/1352803381/photo/solar-panel-inverter.jpg?b=1&s=612x612&w=0&k=20&c=Hyltw_GouBpRsROeOZdxyNSr6Lzeo6eyeppYfXMLTmY=",
        inverterQuantity: 1,
        inverterWarranty: "2 years warranty",
        battery: " 5kw lithium battery",
        batteryQuantity: 1,
        batteryImage: "https://media.istockphoto.com/id/1620576275/photo/close-up-view-of-home-battery-storage-system-on-building-facade.jpg?b=1&s=612x612&w=0&k=20&c=L5C8M4hfXLt_OscTaK_KnhY_GHXrIGGVvkMB3D6KS04=",
        batteryWarranty: "10 years warranty",
        amount: 9546000,
        vat: 715950,
        totalAmount: 10261950,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      }
    );
    }

    if (totalWattage >= 6251 && totalWattage <= 12500) {
      recommendations.push({
        panel: " 450w monocrystaline solar penel",
        panelQuantity: 20,
        panelImage: "https://images.pexels.com/photos/159243/solar-solar-cells-photovoltaic-environmentally-friendly-159243.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
        inverter: " 10kva pure sine wave hybrid inverter",
        inverterImage: "https://media.istockphoto.com/id/1352803381/photo/solar-panel-inverter.jpg?b=1&s=612x612&w=0&k=20&c=Hyltw_GouBpRsROeOZdxyNSr6Lzeo6eyeppYfXMLTmY=",
        inverterQuantity: 1,
        inverterWarranty: "2 years warranty",
        battery: " 16kw lithium battery",
        batteryQuantity: 1,
        batteryImage: "https://media.istockphoto.com/id/1620576275/photo/close-up-view-of-home-battery-storage-system-on-building-facade.jpg?b=1&s=612x612&w=0&k=20&c=L5C8M4hfXLt_OscTaK_KnhY_GHXrIGGVvkMB3D6KS04=",
        batteryWarranty: "10 years warranty",
        amount: 13980000,
        vat: 1048500,
        totalAmount: 15028500,
        dailyConsumption: ((totalWattage * (totalDayHours + totalNightHours))/1000).toFixed(2) + " kWh"
      });
    } 


    if (recommendations.length === 0) {
      return res.status(400).json({ message: "Total wattage is outside the supported range. Please contact support for custom solutions." });
    }
    
    const result = {
      totalWattage,
      recommendations: recommendations,
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router; // Export the router