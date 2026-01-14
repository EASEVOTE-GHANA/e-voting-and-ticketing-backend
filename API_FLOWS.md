# EaseVote API Flows - Frontend Developer Guide

This document outlines the complete API flows for different user journeys in the EaseVote platform.

---

## 🔐 AUTHENTICATION FLOW

### 1. User Registration & Login
```
1. POST /api/auth/register
   Body: { fullName, email, password, role }
   → Returns: { message: "Registration successful. Please verify your email." }

2. POST /api/auth/verify-email
   Body: { email, token }
   → Returns: { message: "Email verified successfully" }

3. POST /api/auth/login
   Body: { email, password }
   → Returns: { token, user: { id, fullName, email, role } }
   → Store token for subsequent requests
```

### 2. Password Reset
```
1. POST /api/auth/forgot-password
   Body: { email }
   → Returns: { message: "Password reset token sent to email" }

2. POST /api/auth/reset-password
   Body: { email, token, newPassword }
   → Returns: { message: "Password reset successful" }
```

---

## 🎫 TICKETING EVENT FLOW

### Organizer: Create Ticketing Event
```
1. POST /api/events
   Headers: { Authorization: "Bearer {token}" }
   Body: {
     title, description, type: "TICKETING",
     startDate, endDate, venue, location,
     ticketSaleStartDate, ticketSaleEndDate
   }
   → Returns: event object with eventCode

2. POST /api/events/:eventId/ticket-types
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, price, quantity }
   → Returns: updated event with ticket types

3. PATCH /api/events/:eventId/submit
   Headers: { Authorization: "Bearer {token}" }
   → Submits event for admin review

4. [ADMIN] PATCH /api/events/:eventId/approve
   → Admin approves event

5. PATCH /api/events/:eventId/publish
   Headers: { Authorization: "Bearer {token}" }
   → Organizer publishes event (now visible to public)
```

### Public: Browse & Purchase Tickets
```
1. GET /api/events?type=TICKETING
   → Returns: paginated list of published ticketing events

2. GET /api/events/:eventId
   → Returns: event details with ticket types

3. POST /api/purchases/tickets/initialize
   Body: {
     eventId,
     ticketTypeId,
     quantity,
     buyerName,
     buyerEmail,
     buyerPhone
   }
   → Returns: { paymentUrl, reference }
   → Redirect user to paymentUrl

4. GET /api/purchases/verify/:reference
   → After payment, verify transaction status
   → Returns: { status: "success", purchase }

5. GET /api/tickets/:ticketCode
   → View ticket details using ticket code
```

---

## 🗳️ VOTING EVENT FLOW (Without Nominations)

### Organizer: Create Voting Event
```
1. POST /api/events
   Headers: { Authorization: "Bearer {token}" }
   Body: {
     title, description, type: "VOTING",
     startDate, endDate,
     costPerVote, minVotesPerPurchase, maxVotesPerPurchase,
     allowPublicNominations: false,
     liveResults: true,
     showVoteCount: true
   }
   → Returns: event object

2. POST /api/events/:eventId/categories
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, description }
   → Returns: updated event with category
   → Repeat for multiple categories

3. POST /api/events/:eventId/categories/:categoryId/candidates
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, email, phone, imageUrl, description }
   → Returns: updated event with candidate
   → Repeat for all candidates

4. PATCH /api/events/:eventId/submit
   → Submit for review

5. [ADMIN] PATCH /api/events/:eventId/approve
   → Admin approves

6. PATCH /api/events/:eventId/publish
   → Organizer publishes event
```

### Public: Browse & Vote
```
1. GET /api/events?type=VOTING
   → Returns: paginated list of published voting events

2. GET /api/events/:eventId
   → Returns: event with categories and candidates

3. GET /api/events/:eventId/categories
   → Returns: all categories for the event

4. GET /api/events/:eventId/categories/:categoryId
   → Returns: specific category with candidates

5. GET /api/events/:eventId/candidates/:candidateCode
   → Returns: specific candidate details

6. POST /api/purchases/votes/initialize
   Body: {
     eventId,
     numberOfVotes,
     buyerName,
     buyerEmail,
     buyerPhone
   }
   → Returns: { paymentUrl, reference }
   → Redirect to paymentUrl

7. GET /api/purchases/verify/:reference
   → Verify payment completed
   → Returns: { status: "success", purchase, voteCode }

8. POST /api/votes/events/:eventId/vote/:candidateCode
   Body: { voteCode, numberOfVotes }
   → Cast votes for candidate
   → Returns: { message: "Vote cast successfully" }

9. GET /api/votes/events/:eventId/results
   → View live results (if enabled by organizer)
```

---

## 🏆 VOTING EVENT FLOW (With Public Nominations)

### Organizer: Setup Event with Nominations
```
1. POST /api/events
   Headers: { Authorization: "Bearer {token}" }
   Body: {
     title, description, type: "VOTING",
     startDate, endDate,
     nominationStartDate, nominationEndDate,
     votingStartDate, votingEndDate,
     costPerVote,
     allowPublicNominations: true
   }
   → Returns: event object

2. POST /api/events/:eventId/categories
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, description }
   → Create categories for nominations

3. POST /api/nominations/events/:eventId/form
   Headers: { Authorization: "Bearer {token}" }
   Body: {
     customFields: [
       { question: "Why nominate?", type: "textarea", required: true },
       { question: "Relationship?", type: "text", required: false }
     ]
   }
   → Creates nomination form

4. PATCH /api/events/:eventId/submit
   → Submit for review

5. [ADMIN] PATCH /api/events/:eventId/approve
   → Admin approves

6. PATCH /api/events/:eventId/publish
   → Publish event (nominations now open)
```

### Public: Submit Nominations
```
1. GET /api/events/:eventId
   → Check if allowPublicNominations is true

2. GET /api/nominations/events/:eventId/form
   → Returns: { eventId, eventTitle, categories, customFields }

3. POST /api/nominations/events/:eventId/submit
   Body: {
     categoryId,
     nomineeName,
     nomineePhone,
     bio,
     photoUrl,
     customFields: [
       { question: "Why nominate?", answer: "..." }
     ],
     nominatorName,
     nominatorPhone
   }
   → Returns: nomination object with status: "PENDING"
```

### Organizer: Review & Approve Nominations
```
1. GET /api/nominations/events/:eventId?status=PENDING&page=1&limit=10
   Headers: { Authorization: "Bearer {token}" }
   → Returns: paginated list of pending nominations

2. GET /api/nominations/events/:eventId?categoryId=:categoryId
   → Filter nominations by category

3. PATCH /api/nominations/:nominationId/approve
   Headers: { Authorization: "Bearer {token}" }
   → Approves nomination & auto-creates candidate
   → Returns: { message: "Nomination approved and candidate created" }

4. PATCH /api/nominations/:nominationId/reject
   Headers: { Authorization: "Bearer {token}" }
   → Rejects nomination
   → Returns: { message: "Nomination rejected" }
```

### Public: Vote (After Nomination Period)
```
[Follow same voting flow as "Voting Event Flow (Without Nominations)" steps 6-9]
```

---

## 📊 ORGANIZER DASHBOARD FLOW

### View My Events
```
1. GET /api/events/my/events?page=1&limit=10
   Headers: { Authorization: "Bearer {token}" }
   → Returns: paginated list of organizer's events

2. GET /api/events/my/events?type=VOTING&status=LIVE
   → Filter by type and status
```

### Manage Event Settings
```
1. PUT /api/events/:eventId
   Headers: { Authorization: "Bearer {token}" }
   Body: { title, description, costPerVote, etc. }
   → Update event details

2. PATCH /api/events/:eventId/toggle-live-results
   Headers: { Authorization: "Bearer {token}" }
   → Toggle live results visibility

3. PATCH /api/events/:eventId/toggle-vote-count
   Headers: { Authorization: "Bearer {token}" }
   → Toggle vote count display
```

### View Event Analytics
```
1. GET /api/purchases/events/:eventId
   Headers: { Authorization: "Bearer {token}" }
   → Returns: all purchases for the event

2. GET /api/votes/events/:eventId/results
   Headers: { Authorization: "Bearer {token}" }
   → View detailed voting results (organizer sees all data)
```

### Manage Categories & Candidates
```
1. PUT /api/events/:eventId/categories/:categoryId
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, description }
   → Update category

2. DELETE /api/events/:eventId/categories/:categoryId
   Headers: { Authorization: "Bearer {token}" }
   → Delete category

3. PUT /api/events/:eventId/categories/:categoryId/candidates/:candidateId
   Headers: { Authorization: "Bearer {token}" }
   Body: { name, email, phone, imageUrl, description }
   → Update candidate

4. DELETE /api/events/:eventId/categories/:categoryId/candidates/:candidateId
   Headers: { Authorization: "Bearer {token}" }
   → Delete candidate
```

---

## 👑 ADMIN FLOW

### Manage All Events
```
1. GET /api/events/admin/all?page=1&limit=10
   Headers: { Authorization: "Bearer {token}" }
   → Returns: all events (any status)

2. GET /api/events/admin/all?status=PENDING_REVIEW
   → Filter events pending review

3. PATCH /api/events/:eventId/approve
   Headers: { Authorization: "Bearer {token}" }
   → Approve event

4. GET /api/events/admin/deleted
   Headers: { Authorization: "Bearer {token}" }
   → View soft-deleted events
```

---

## 📤 FILE UPLOAD FLOW

### Upload Images (Candidate photos, Event banners, etc.)
```
1. POST /api/upload
   Headers: { 
     Authorization: "Bearer {token}",
     Content-Type: "multipart/form-data"
   }
   Body: FormData with 'file' field
   → Returns: { url: "https://cloudinary.com/..." }
   
2. Use returned URL in subsequent requests
   (e.g., when creating candidate or submitting nomination)
```

---

## 🔄 PURCHASE HISTORY FLOW

### User Views Purchase History
```
1. GET /api/purchases/history?page=1&limit=10
   Headers: { Authorization: "Bearer {token}" }
   → Returns: paginated list of user's purchases (tickets & votes)
```

---

## 📱 COMMON PATTERNS

### Pagination
All list endpoints support:
- `?page=1` (default: 1)
- `?limit=10` (default: 10)

### Authentication
Protected endpoints require:
```
Headers: {
  Authorization: "Bearer {token}"
}
```

### Error Responses
All endpoints return errors in format:
```json
{
  "message": "Error description",
  "statusCode": 400
}
```

### Success Responses
Most mutations return:
```json
{
  "message": "Action successful",
  "data": { ... }
}
```

---

## 🎯 QUICK REFERENCE

| User Type | Primary Flows |
|-----------|---------------|
| **Public User** | Browse Events → Purchase Tickets/Votes → Submit Nominations |
| **Organizer** | Create Event → Add Categories/Candidates → Submit for Review → Publish → Manage Nominations |
| **Admin** | Review Events → Approve/Reject |

---

**Base URL**: `http://localhost:3000` (development)

**Note**: All dates should be in ISO 8601 format (e.g., `2024-12-31T23:59:59Z`)
