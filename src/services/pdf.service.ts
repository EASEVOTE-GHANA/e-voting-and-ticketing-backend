import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import axios from "axios";

export interface IPDFTicketData {
  eventTitle: string;
  eventDate: string;
  venue: string;
  customerName: string;
  ticketNumber: string;
  ticketTypeName: string;
  qrData: string;
  eventImage?: string;
}

export class PDFService {
  static async generateTicketPDF(data: IPDFTicketData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [600, 250],
          margin: 0,
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        // -- Background & Layout --
        // Primary Brand Color: #5b0058
        doc.rect(0, 0, 600, 250).fill("#ffffff");
        doc.rect(0, 0, 420, 250).fill("#5b0058");

        // -- Event Image (as background for left side if available) --
        if (data.eventImage) {
          try {
            const response = await axios.get(data.eventImage, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(response.data);
            
            // Draw image on left side
            doc.save();
            doc.image(imageBuffer, 0, 0, { width: 420, height: 250, cover: [420, 250] });
            // Add a dark overlay to ensure text readability
            doc.rect(0, 0, 420, 250).fillOpacity(0.7).fill("#5b0058");
            doc.restore();
          } catch (e) {
            console.error("[PDFService] Failed to load event image for PDF:", e);
          }
        }

        // -- Text Content (Left Side) --
        doc.fillColor("#ffffff");
        
        // Official Badge
        doc.fontSize(8).font("Helvetica-Bold").text("OFFICIAL ACCESS TICKET", 30, 30, { characterSpacing: 1.5 });
        
        // Event Title
        doc.fontSize(22).font("Helvetica-Bold").text(data.eventTitle.toUpperCase(), 30, 60, { width: 360, lineGap: 5 });
        
        // Event Details
        doc.fontSize(10).font("Helvetica").text(`DATE: ${data.eventDate}`, 30, 140);
        doc.fontSize(10).font("Helvetica").text(`VENUE: ${data.venue}`, 30, 155);
        
        // Ticket Category (Highlighted)
        doc.rect(30, 185, 120, 25).fill("#d3067d");
        doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold").text(data.ticketTypeName.toUpperCase(), 40, 193);

        // -- Customer Info --
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica").text(`HOLDER: ${data.customerName.toUpperCase()}`, 30, 220);

        // -- Right Side (Verification) --
        doc.fillColor("#171717");
        
        // QR Code Placeholder (We use a dynamic QR service or we can draw one if we had a lib)
        // Since we need a QR code, and I don't see a QR lib in package.json yet, 
        // I'll use a public API for the PDF QR image to keep it simple and reliable.
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qrData)}`;
        try {
          const qrResponse = await axios.get(qrUrl, { responseType: "arraybuffer" });
          const qrBuffer = Buffer.from(qrResponse.data);
          doc.image(qrBuffer, 440, 40, { width: 130 });
        } catch (e) {
          doc.rect(440, 40, 130, 130).stroke("#e5e5e5");
          doc.fontSize(8).text("QR CODE UNAVAILABLE", 455, 100);
        }

        // Ticket Number
        doc.fontSize(9).font("Helvetica-Bold").text("TICKET ID", 440, 185);
        doc.fontSize(12).font("Courier-Bold").text(data.ticketNumber, 440, 200, { characterSpacing: 1 });
        
        // Branding at bottom right
        doc.fontSize(8).fillColor("#a3a3a3").text("VERIFY AT ENTRANCE", 440, 225);

        // -- Cutting Line --
        doc.moveTo(420, 0).lineTo(420, 250).dash(5, { space: 5 }).stroke("#eeeeee");

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
