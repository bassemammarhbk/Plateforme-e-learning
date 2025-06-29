const express = require("express")
const router = express.Router()
const Certification = require("../models/certificat")
const Etudiant = require("../models/etudiant")
const { verifyToken } = require("../middlwares/verifToken")
const PDFDocument = require("pdfkit")
const QRCode = require("qrcode")
const crypto = require("crypto")

router.get("/cours/:coursId", verifyToken, async (req, res) => {
  try {
    console.log("Certification request for course:", req.params.coursId, "user:", req.user.id)

    const etudiant = await Etudiant.findOne({ userId: req.user.id })
    if (!etudiant) {
      console.log("No student found for user:", req.user.id)
      return res.status(404).json({ message: "Étudiant non trouvé" })
    }

    const certification = await Certification.findOne({
      etudiant: etudiant._id,
      cours: req.params.coursId,
    })
      .populate({
        path: "etudiant",
        populate: {
          path: "userId",
          select: "firstname lastname email",
        },
      })
      .populate("cours", "nomcours description")

    if (!certification) {
      console.log("No certification found for course:", req.params.coursId, "student:", etudiant._id)
      return res.status(404).json({ message: "Certification non trouvée" })
    }

    // Generate verification code if not exists
    if (!certification.verificationCode) {
      certification.verificationCode = crypto.randomBytes(8).toString("hex").toUpperCase()
      await certification.save()
    }

    // Validate and prepare data
    const user = certification.etudiant?.userId
    const studentName = user ? `${user.firstname} ${user.lastname}`.trim() : "Unknown Student"
    const studentEmail = user?.email || ""
    const courseName = certification.cours?.nomcours || "Unknown Course"
    const courseDescription = certification.cours?.description || ""
    const finalScore = certification.finalScore ?? 0
    const issueDate = certification.issueDate || new Date()
    const verificationCode = certification.verificationCode
    const certificateId = certification._id.toString()

    // Format date
    const formattedDate = new Date(issueDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

    // Create verification URL for QR code
    const verificationUrl = `${req.protocol}://${req.get("host")}/verify-certificate/${verificationCode}`

    if (!studentName || !courseName) {
      console.error("Missing required fields:", { studentName, courseName })
      return res.status(500).json({ message: "Données de certification incomplètes" })
    }

    // Generate QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 100,
      margin: 1,
      color: {
        dark: "#1a365d",
        light: "#ffffff",
      },
    })

    // Create PDF document with modern settings
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Certificat de Réussite - ${courseName}`,
        Author: "Learnista",
        Subject: `Certificat de réussite pour ${studentName}`,
        Keywords: "certificat, formation, réussite, learnista",
        Creator: "Learnista Platform",
        Producer: "Learnista PDF Generator",
      },
    })

    // Collect PDF data
    const buffers = []
    doc.on("data", buffers.push.bind(buffers))
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers)
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=certificat-${studentName.replace(/\s+/g, "-")}-${verificationCode}.pdf`,
      )
      res.setHeader("Cache-Control", "no-cache")
      console.log("Modern PDF certificate generated successfully")
      res.send(pdfBuffer)
    })

    // Modern Color Palette
    const colors = {
      primary: "#1a365d", // Deep blue
      secondary: "#2d3748", // Dark gray
      accent: "#3182ce", // Bright blue
      gold: "#d69e2e", // Gold
      success: "#38a169", // Green
      background: "#f7fafc", // Light gray
      white: "#ffffff",
      text: "#2d3748",
      lightText: "#718096",
      border: "#e2e8f0",
    }

    // Page dimensions
    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const centerX = pageWidth / 2

    // Background with subtle gradient effect
    doc.rect(0, 0, pageWidth, pageHeight).fill(colors.background)

    // Modern decorative background pattern
    const drawBackgroundPattern = () => {
      doc.save()
      doc.opacity(0.02)

      // Geometric pattern - more subtle
      for (let i = 0; i < pageWidth; i += 80) {
        for (let j = 0; j < pageHeight; j += 80) {
          doc.circle(i, j, 1).fill(colors.primary)
        }
      }

      doc.restore()
    }

    drawBackgroundPattern()

    // Main certificate container
    const containerMargin = 30
    const containerWidth = pageWidth - containerMargin * 2
    const containerHeight = pageHeight - containerMargin * 2

    // White background
    doc.rect(containerMargin, containerMargin, containerWidth, containerHeight).fill(colors.white)

    // Modern border design - simplified
    const drawModernBorder = () => {
      // Outer border
      doc.lineWidth(3)
      doc.strokeColor(colors.primary)
      doc.rect(containerMargin + 8, containerMargin + 8, containerWidth - 16, containerHeight - 16).stroke()

      // Inner accent line
      doc.lineWidth(1)
      doc.strokeColor(colors.accent)
      doc.rect(containerMargin + 12, containerMargin + 12, containerWidth - 24, containerHeight - 24).stroke()

      // Corner decorations - smaller and positioned better
      const cornerSize = 20
      const corners = [
        { x: containerMargin + 20, y: containerMargin + 20 }, // Top-left
        { x: pageWidth - containerMargin - 20, y: containerMargin + 20 }, // Top-right
        { x: containerMargin + 20, y: pageHeight - containerMargin - 20 }, // Bottom-left
        { x: pageWidth - containerMargin - 20, y: pageHeight - containerMargin - 20 }, // Bottom-right
      ]

      doc.strokeColor(colors.gold)
      doc.lineWidth(2)

      corners.forEach((corner, index) => {
        if (index === 0) {
          // Top-left
          doc
            .moveTo(corner.x, corner.y + cornerSize)
            .lineTo(corner.x, corner.y)
            .lineTo(corner.x + cornerSize, corner.y)
            .stroke()
        } else if (index === 1) {
          // Top-right
          doc
            .moveTo(corner.x - cornerSize, corner.y)
            .lineTo(corner.x, corner.y)
            .lineTo(corner.x, corner.y + cornerSize)
            .stroke()
        } else if (index === 2) {
          // Bottom-left
          doc
            .moveTo(corner.x, corner.y - cornerSize)
            .lineTo(corner.x, corner.y)
            .lineTo(corner.x + cornerSize, corner.y)
            .stroke()
        } else {
          // Bottom-right
          doc
            .moveTo(corner.x - cornerSize, corner.y)
            .lineTo(corner.x, corner.y)
            .lineTo(corner.x, corner.y - cornerSize)
            .stroke()
        }
      })
    }

    drawModernBorder()

    // Header section - repositioned
    const headerY = containerMargin + 40

    // Platform name
    doc
      .fillColor(colors.primary)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("LEARNISTA", containerMargin + 50, headerY)

    // Subtitle
    doc
      .fillColor(colors.lightText)
      .fontSize(10)
      .font("Helvetica")
      .text("PLATEFORME D'APPRENTISSAGE EN LIGNE", containerMargin + 50, headerY + 28)

    // Decorative line under header - repositioned
    doc
      .moveTo(containerMargin + 50, headerY + 45)
      .lineTo(containerMargin + 280, headerY + 45)
      .strokeColor(colors.accent)
      .lineWidth(2)
      .stroke()

    // Certificate title - repositioned and spaced properly
    const titleY = headerY + 70
    doc.fillColor(colors.primary).fontSize(36).font("Helvetica-Bold").text("CERTIFICAT", 0, titleY, {
      align: "center",
      width: pageWidth,
    })

    doc
      .fillColor(colors.accent)
      .fontSize(20)
      .font("Helvetica")
      .text("DE RÉUSSITE", 0, titleY + 45, {
        align: "center",
        width: pageWidth,
      })

    // Decorative elements around title - repositioned to not interfere
    const decorativeY = titleY + 75
    doc
      .moveTo(centerX - 120, decorativeY)
      .lineTo(centerX - 40, decorativeY)
      .strokeColor(colors.gold)
      .lineWidth(3)
      .stroke()

    doc
      .moveTo(centerX + 40, decorativeY)
      .lineTo(centerX + 120, decorativeY)
      .strokeColor(colors.gold)
      .lineWidth(3)
      .stroke()

    // Main content section - properly spaced
    const contentY = titleY + 95

    // "This certifies that" text
    doc.fillColor(colors.text).fontSize(14).font("Helvetica").text("Ceci certifie que", 0, contentY, {
      align: "center",
      width: pageWidth,
    })

    // Student name with elegant styling
    const nameY = contentY + 25
    doc.fillColor(colors.primary).fontSize(28).font("Helvetica-Bold").text(studentName.toUpperCase(), 0, nameY, {
      align: "center",
      width: pageWidth,
    })

    // Underline for name - properly positioned
    const nameWidth = doc.widthOfString(studentName.toUpperCase(), { fontSize: 28 })
    doc
      .moveTo(centerX - nameWidth / 2, nameY + 35)
      .lineTo(centerX + nameWidth / 2, nameY + 35)
      .strokeColor(colors.accent)
      .lineWidth(2)
      .stroke()

    // Achievement text
    const achievementY = nameY + 50
    doc.fillColor(colors.text).fontSize(16).font("Helvetica").text("a complété avec succès le cours", 0, achievementY, {
      align: "center",
      width: pageWidth,
    })

    // Course name with highlighting
    const courseY = achievementY + 25
    doc.fillColor(colors.primary).fontSize(22).font("Helvetica-Bold").text(`"${courseName}"`, 0, courseY, {
      align: "center",
      width: pageWidth,
    })

    // Footer section - properly positioned
    const footerY = pageHeight - containerMargin - 100

    // Left side - Date and verification
    doc
      .fillColor(colors.text)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Date d'émission:", containerMargin + 50, footerY)

    doc
      .fillColor(colors.lightText)
      .fontSize(12)
      .font("Helvetica")
      .text(formattedDate, containerMargin + 50, footerY + 18)

    doc
      .fillColor(colors.text)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Code de vérification:", containerMargin + 50, footerY + 40)

    doc
      .fillColor(colors.primary)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(verificationCode, containerMargin + 50, footerY + 58)

    // Right side - QR Code section (moved away from border)
    const qrX = pageWidth - containerMargin - 130
    const qrY = footerY - 40

    // QR Code background
    doc
      .rect(qrX - 5, qrY - 5, 110, 110)
      .fill(colors.white)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke()

    // Add QR code image
    const qrBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64")
    doc.image(qrBuffer, qrX, qrY, { width: 100, height: 100 })

    doc
      .fillColor(colors.lightText)
      .fontSize(9)
      .font("Helvetica")
      .text("Scanner pour vérifier", qrX - 5, qrY + 105, {
        width: 110,
        align: "center",
      })

    // Finalize document
    doc.end()
  } catch (err) {
    console.error("Error generating modern certificate:", err)
    res.status(500).json({
      message: "Erreur lors de la génération du certificat",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    })
  }
})

// Route for certificate verification
router.get("/verify/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params

    const certification = await Certification.findOne({ verificationCode })
      .populate({
        path: "etudiant",
        populate: {
          path: "userId",
          select: "firstname lastname",
        },
      })
      .populate("cours", "nomcours")

    if (!certification) {
      return res.status(404).json({
        valid: false,
        message: "Certificat non trouvé",
      })
    }

    const user = certification.etudiant?.userId
    const studentName = user ? `${user.firstname} ${user.lastname}`.trim() : "Unknown Student"
    const courseName = certification.cours?.nomcours || "Unknown Course"

    res.json({
      valid: true,
      certificate: {
        studentName,
        courseName,
        issueDate: certification.issueDate,
        finalScore: certification.finalScore,
        verificationCode: certification.verificationCode,
      },
    })
  } catch (err) {
    console.error("Error verifying certificate:", err)
    res.status(500).json({
      valid: false,
      message: "Erreur lors de la vérification",
    })
  }
})

module.exports = router
