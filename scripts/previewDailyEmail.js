// Run: node scripts/previewDailyEmail.js
// Writes preview.html with mock data — open in browser to inspect the template.

import { writeFileSync } from "fs";
import { buildRooftopReportHtml } from "../server/emailTemplateDaily.js";

const dateLabel = "17 Apr 2026";

const rooftopData = {
  rooftopName:     "GM Supercenter Dallas",
  // Yesterday
  newVins:         14,
  imagesReceived:  142,
  vinsDelivered:   11,
  imagesProcessed: 108,
  vinsPending:      3,
  avgTtdHrs:       1.93,
  // Inventory totals
  totalActive:     247,
  withPhotos:      198,
  withPhotosPct:   80.2,
  totalDelivered:  189,
  totalPending:     58,
  deliveryPct:      76.5,
  pendingPct:       23.5,
  // Published yesterday (max 5)
  processedVins: [
    {
      thumbnail_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=200&q=80",
      vin:           "1GCUDJE80PZ185828",
      stock_number: "A12345",
      make:          "Chevrolet",
      model:         "Silverado 1500",
      year:          "2023",
      trim:          "High Country Crew Cab 4WD",
      vehicle_price: 62500,
      received_at:   "2026-04-17T06:14:00Z",
      processed_at:  "2026-04-17T08:02:00Z",
      ttd_hrs:       1.8,
    },
    {
      thumbnail_url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=200&q=80",
      vin:           "1FTEW1E85NFB75583",
      stock_number: "B98765",
      make:          "Ford",
      model:         "F-150",
      year:          "2022",
      trim:          "Lariat SuperCrew 5.5-ft. Bed 4WD",
      vehicle_price: 54900,
      received_at:   "2026-04-17T07:30:00Z",
      processed_at:  "2026-04-17T09:45:00Z",
      ttd_hrs:       2.25,
    },
    {
      thumbnail_url: null,
      vin:           "4T1G11AK9PU130360",
      stock_number: "C11223",
      make:          "Toyota",
      model:         "Camry",
      year:          "2023",
      trim:          "SE",
      vehicle_price: 27400,
      received_at:   "2026-04-17T08:00:00Z",
      processed_at:  "2026-04-17T09:55:00Z",
      ttd_hrs:       1.92,
    },
    {
      thumbnail_url: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=200&q=80",
      vin:           "5FNRL5H68GB123456",
      stock_number: "D44556",
      make:          "Honda",
      model:         "Odyssey",
      year:          "2021",
      trim:          "EX-L",
      vehicle_price: 38200,
      received_at:   "2026-04-17T09:10:00Z",
      processed_at:  "2026-04-17T11:00:00Z",
      ttd_hrs:       1.83,
    },
    {
      thumbnail_url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=200&q=80",
      vin:           "WBAVA33556KS99001",
      stock_number: null,
      make:          "BMW",
      model:         "3 Series",
      year:          "2024",
      trim:          "330i xDrive Sedan",
      vehicle_price: 48900,
      received_at:   "2026-04-17T10:00:00Z",
      processed_at:  "2026-04-17T11:52:00Z",
      ttd_hrs:       1.87,
    },
  ],
  // Vehicles without photos (top 5 shown)
  noImageVins: [
    { vin: "JM1BL1SF5A1234567", stock_number: "E77001", make: "Mazda",   model: "CX-5",       year: "2022", trim: "Grand Touring AWD",        days_on_lot: 9  },
    { vin: "WBAVA33556KS12345", stock_number: "F22334", make: "BMW",     model: "5 Series",   year: "2023", trim: "530i xDrive Sedan",         days_on_lot: 6  },
    { vin: "1G1ZT53806F109149", stock_number: null,     make: "Chevy",   model: "Malibu",     year: "2021", trim: "LT",                        days_on_lot: 4  },
    { vin: "1HGCV1F30MA012345", stock_number: "G55102", make: "Honda",   model: "Accord",     year: "2021", trim: "Sport 2.0T",                days_on_lot: 2  },
    { vin: "5XXGT4L31LG012345", stock_number: "H88001", make: "Kia",     model: "Optima",     year: "2020", trim: "LX",                        days_on_lot: 1  },
  ],
  noImagesTotal: 18,
};

const html = buildRooftopReportHtml(rooftopData, dateLabel);
writeFileSync("preview.html", html);
console.log("✓ preview.html written — open it in your browser.");
