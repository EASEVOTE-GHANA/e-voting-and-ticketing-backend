# EaseVote Backend

This repository contains the backend service for EaseVote, an e-voting and ticketing platform. 

## Infrastructure & Hosting

The platform is hosted across various services to ensure reliability and performance.

- **Frontend Hosting**: [Vercel](https://vercel.com/)
- **Backend Hosting**: [Hostinger (VPS)](https://www.hostinger.com/)
- **Domain Name Registrar**: [Namecheap](https://www.namecheap.com/)

## Technologies

- Node.js
- Express.js
- TypeScript
- MongoDB & Mongoose

## Third-Party Services Used

We integrate with several external services to provide SMS, USSD, payments, and file storage capabilities.

### 1. Payment Gateways
We support multiple payment providers for purchasing tickets and votes:
- **Paystack**
- **Flutterwave** (Placeholder. not really implemented as no flutterwave account exists)
- **AppsMobile**
- **Nalo Solutions (Nalo Payment)**
- **Moolre** (Also a placeholer as moolre was at a point considered)

### 2. SMS Providers
For notifications and OTPs:
- **Nalo Solutions** (Default)
- **Termii** (Placeholder)

### 3. USSD Service
For USSD voting and ticketing:
- **Nalo Solutions**

### 4. Emails
- **Resend** (uses for testing. not really implemented as no resend account exists)
- **Nalo Solutions**

### 5. File & Image Storage
- **Cloudinary** (for storing event banners, candidate photos, and user uploads)

## Environment Setup

Please refer to the `README-ENV.md` file for details on how to configure the environment variables required for these third-party services.
