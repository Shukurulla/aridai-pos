---
tags: [data-model, diagramma]
created: 2026-05-28
---

# ER diagrammasi

## Core entity'lar (tool'larsiz)

```mermaid
erDiagram
    RESTAURANT ||--o{ BRANCH : "ega"
    RESTAURANT {
        ObjectId _id
        string brand
        string logo
        object owner
        object features
        number tokenVersion
    }

    BRANCH ||--o{ USER : "xodimlari"
    BRANCH ||--o{ FOOD : "menyu"
    BRANCH ||--o{ CATEGORY : "kategoriyalar"
    BRANCH ||--o{ TABLE : "stollar"
    BRANCH ||--o{ SHIFT : "smenalar"
    BRANCH ||--o{ DISCOUNT : "chegirmalar"
    BRANCH ||--o| SERVICE : "xizmat haqqi"
    BRANCH {
        ObjectId _id
        string name
        string address
        ObjectId restaurant
        string currentMode
        date lastSyncedAt
        number tokenVersion
    }

    USER {
        ObjectId _id
        string name
        string phone
        string password
        string role
        string image
        ObjectId branch
        ObjectId restaurantId
        number tokenVersion
        boolean isActive
    }

    CATEGORY ||--o{ FOOD : "ichida"
    CATEGORY {
        ObjectId _id
        string title
        ObjectId branch
        ObjectId restaurantId
        number sortOrder
        boolean isActive
    }

    FOOD {
        ObjectId _id
        string name
        string description
        number price
        string image
        ObjectId branch
        ObjectId category
        ObjectId restaurantId
        array recipe
        boolean isActive
        number sortOrder
    }

    TABLE {
        ObjectId _id
        number number
        string title
        string type
        array tariffs
        ObjectId branch
        ObjectId restaurantId
        string qrSlug
        boolean qrEnabled
    }

    SHIFT ||--o{ ORDER : "ichida"
    SHIFT {
        ObjectId _id
        ObjectId branch
        ObjectId restaurantId
        boolean isActive
        ObjectId openedBy
        date openedAt
        ObjectId closedBy
        date closedAt
        number totalRevenue
        number totalOrders
    }

    SERVICE {
        ObjectId _id
        ObjectId branch
        ObjectId restaurantId
        number servicePercent
        boolean isActive
    }

    DISCOUNT {
        ObjectId _id
        string title
        number discountPercent
        ObjectId branch
        ObjectId restaurantId
        boolean isActive
    }

    USER ||--o{ ORDER : "waiter"
    TABLE ||--o{ ORDER : "stol"
    FOOD ||--o{ ORDER_ITEM : "tanlanadi"
    DISCOUNT ||--o{ ORDER : "qo'llaniladi"
    SERVICE ||--o{ ORDER : "qo'llaniladi"

    ORDER ||--|{ ORDER_ITEM : "ichida"
    ORDER {
        ObjectId _id
        ObjectId branch
        ObjectId shift
        ObjectId restaurantId
        string orderType
        ObjectId waiter
        ObjectId table
        ObjectId service
        object selectedTariff
        ObjectId discount
        number discountAmount
        number subTotal
        number totalPrice
        boolean isCancel
        string cancelReason
        string paymentStatus
        string paymentMethod
        object mixed
        object cashback
        string createdInMode
        date createdAt
        date updatedAt
    }

    ORDER_ITEM {
        ObjectId foodId
        string foodName
        number foodPrice
        number quantity
        array cancels
    }
```

## Sync infrastructure entity'lari

```mermaid
erDiagram
    OUTBOX {
        UUID _id
        string eventType
        ObjectId entityId
        object payload
        date createdAt
        date sentAt
        date ackedAt
        number retryCount
        string lastError
    }

    AUDIT_LOG {
        ObjectId _id
        string kind
        string severity
        object actor
        ObjectId restaurantId
        ObjectId branchId
        string message
        object data
        string ip
        string endpoint
        date ts
    }

    EVENT_DEDUP {
        UUID _id
        ObjectId branchId
        date seenAt
    }
```

`OUTBOX` faqat lokal MongoDB'da. `AUDIT_LOG` faqat global'da. `EVENT_DEDUP` ikkalasida.

## Tool entity'lari (toggle'lar)

Bu entity'lar faqat tegishli toggle yoqilgan bo'lsa mavjud:

```mermaid
erDiagram
    RESTAURANT ||--o{ INGREDIENT : "sklad toggle"
    BRANCH ||--o{ STOCK : "sklad"
    INGREDIENT ||--o{ STOCK : ""
    STOCK ||--o{ STOCK_MOVEMENT : ""
    INGREDIENT {
        ObjectId _id
        string name
        string unit
        string category
        ObjectId restaurantId
    }
    STOCK {
        ObjectId _id
        ObjectId ingredientId
        ObjectId branchId
        ObjectId restaurantId
        number balance
        number lowAlertThreshold
    }
    STOCK_MOVEMENT {
        ObjectId _id
        ObjectId stockId
        string direction
        number quantity
        string reason
        ObjectId refOrderId
        date createdAt
    }

    USER ||--o{ ATTENDANCE : "keldi-ketti"
    USER ||--|| SALARY_RULE : ""
    USER ||--|| SCHEDULE : ""
    ATTENDANCE {
        ObjectId _id
        ObjectId userId
        date date
        date arrivedAt
        date leftAt
        boolean isLate
        number penalty
    }
    PAYROLL {
        ObjectId _id
        ObjectId userId
        string period
        number totalAmount
    }

    TABLE ||--o{ QR_ORDER_REQUEST : "qr-order"
    QR_ORDER_REQUEST {
        ObjectId _id
        ObjectId tableId
        ObjectId branchId
        array items
        string status
        date expiresAt
    }

    ORDER ||--o| KASPI_TRANSACTION : "qr-pay"
    KASPI_TRANSACTION {
        ObjectId _id
        string kaspiInvoiceId
        ObjectId matchedOrderId
        number amount
        string status
    }

    RESTAURANT ||--o{ CASHBACK_BALANCE : "keshbek"
    CASHBACK_BALANCE ||--o{ CASHBACK_MOVEMENT : ""
    CASHBACK_BALANCE {
        ObjectId _id
        ObjectId restaurantId
        string clientPhone
        number balance
        number totalEarned
    }
    CASHBACK_MOVEMENT {
        ObjectId _id
        ObjectId restaurantId
        string clientPhone
        string direction
        number amount
        ObjectId refOrderId
    }
```

## Ko'p ijaralilik (multi-tenancy) bog'lanishi

Har bir entity'da `restaurantId` (top-level), ko'p hollarda `branchId` ham (sub-tenant) bor. Bu — query speed va xavfsizlik uchun denormalize qilinadi (qarang: [[../02-arxitektura/xavfsizlik/tenant-izolyatsiyasi]]).

```mermaid
flowchart LR
    R[restaurantId] --> B[branchId] --> E[entity]
    R -.guard.-> Q[query]
    B -.guard.-> Q
```

## Bog'liq

- [[_MOC]]
- [[sync-metadata]]
- [[index-strategiyasi]]
- [[snapshot-strategiyasi]]
