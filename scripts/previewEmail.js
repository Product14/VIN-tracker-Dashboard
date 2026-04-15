// Run: node scripts/previewEmail.js
// Opens preview.html in your default browser.

import { buildEmailHtml } from "../server/emailTemplate.js";
import { writeFileSync } from "fs";
import { execSync } from "child_process";

const mockSummary = {
  lastSync: new Date().toISOString(),
  totalRows: 2847,
  totals: {
    total: 2847,
    enterpriseCount: 42,
    withPhotos: 1203,
    deliveredWithPhotos: 891,
    pendingWithPhotos: 312,
    processed: 1891,
    processedAfter24: 743,
    notProcessed: 956,
    notProcessedAfter24: 489,
    bucketProcessingPending: 178,
    bucketPublishingPending: 134,
    bucketQcPending: 89,
    bucketSold: 62,
    bucketOthers: 26,
  },
  byBucket: [
    { label: "Processing Pending", count: 178 },
    { label: "Publishing Pending", count: 134 },
    { label: "QC Pending",         count: 89  },
    { label: "QC Hold",            count: 45  },
    { label: "Sold",               count: 62  },
    { label: "Others",             count: 26  },
  ],
  byType: [
    { label: "Franchise Group",        rooftopCount: 18, enterpriseCount: 12, total: 1102, processed: 784, notProcessed: 318, notProcessedAfter24: 201, withPhotos: 520 },
    { label: "Franchise Individual",   rooftopCount: 14, enterpriseCount: 14, total:  843, processed: 561, notProcessed: 282, notProcessedAfter24: 143, withPhotos: 389 },
    { label: "Independent Group",      rooftopCount:  9, enterpriseCount:  8, total:  512, processed: 334, notProcessed: 178, notProcessedAfter24:  91, withPhotos: 201 },
    { label: "Independent Individual", rooftopCount:  7, enterpriseCount:  7, total:  310, processed: 174, notProcessed: 136, notProcessedAfter24:  48, withPhotos:  85 },
    { label: "Others",                 rooftopCount:  2, enterpriseCount:  1, total:   80, processed:  38, notProcessed:  42, notProcessedAfter24:   6, withPhotos:   8 },
  ],
  byCSM: [
    {
      name: "arjun.sharma@spyne.ai", label: "arjun.sharma@spyne.ai",
      rooftopCount: 14, enterpriseCount: 10, total: 893,
      processed: 612, processedAfter24: 245, notProcessed: 281, notProcessedAfter24: 142,
      withPhotos: 410, deliveredWithPhotos: 320, pendingWithPhotos: 90,
      avgWebsiteScore: 72.4, missingWebsiteCount: 2, integratedCount: 3, publishingCount: 1,
      bucketProcessingPending: 68, bucketPublishingPending: 41, bucketQcPending: 22, bucketQcHold: 11, bucketSold: 0, bucketOthers: 0,
    },
    {
      name: "priya.mehta@spyne.ai", label: "priya.mehta@spyne.ai",
      rooftopCount: 11, enterpriseCount: 9, total: 741,
      processed: 498, processedAfter24: 198, notProcessed: 243, notProcessedAfter24: 121,
      withPhotos: 332, deliveredWithPhotos: 258, pendingWithPhotos: 74,
      avgWebsiteScore: 68.1, missingWebsiteCount: 3, integratedCount: 2, publishingCount: 2,
      bucketProcessingPending: 54, bucketPublishingPending: 38, bucketQcPending: 21, bucketQcHold: 8, bucketSold: 0, bucketOthers: 0,
    },
    {
      name: "rahul.verma@spyne.ai", label: "rahul.verma@spyne.ai",
      rooftopCount: 9, enterpriseCount: 7, total: 612,
      processed: 401, processedAfter24: 167, notProcessed: 211, notProcessedAfter24: 98,
      withPhotos: 278, deliveredWithPhotos: 201, pendingWithPhotos: 77,
      avgWebsiteScore: 64.7, missingWebsiteCount: 1, integratedCount: 4, publishingCount: 3,
      bucketProcessingPending: 40, bucketPublishingPending: 31, bucketQcPending: 18, bucketQcHold: 9, bucketSold: 0, bucketOthers: 0,
    },
    {
      name: null, label: null,
      rooftopCount: 16, enterpriseCount: 16, total: 601,
      processed: 380, processedAfter24: 133, notProcessed: 221, notProcessedAfter24: 128,
      withPhotos: 183, deliveredWithPhotos: 112, pendingWithPhotos: 71,
      avgWebsiteScore: null, missingWebsiteCount: 6, integratedCount: 5, publishingCount: 4,
      bucketProcessingPending: 16, bucketPublishingPending: 24, bucketQcPending: 28, bucketQcHold: 17, bucketSold: 62, bucketOthers: 26,
    },
  ],
};

const html = buildEmailHtml(mockSummary, "12:00 PM IST", "https://your-dashboard.vercel.app");
writeFileSync("preview.html", html);
console.log("✓ preview.html written");
execSync("open preview.html");
