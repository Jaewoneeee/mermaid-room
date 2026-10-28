// Bundled with the app so clean checkouts and production builds need no local files.
export const sequenceExample = `sequenceDiagram
    autonumber
    actor User as 사용자
    participant FE as Frontend
    participant W as Wallet
    participant S as Server
    participant CT as Controller.sol
    participant G as KGLD.sol

    %% 0. 상품·제휴처 조회 (공개 API)
    FE->>S: GET /api/redeem/products
    S-->>FE: 상품 목록과 견적
    FE->>S: GET /api/redeem/agencies
    S-->>FE: 상환 제휴처 목록
    User->>FE: 상품·상환 제휴처 선택

    %% 1. 서명된 상환 견적 받기 (주문은 아직 없음)
    FE->>S: POST /api/redeem/quote<br/>{productId, agencyId}
    S-->>FE: quoteId, quote, signature, submitUntil
    Note over FE,S: 서버에서 받은 견적을 확인하고 사용자에게 표시
    FE->>User: 금액과 견적 만료 시간 표시

    %% 2. 잔액 확인
    FE->>G: balanceOf(owner), getFrozenTokens(owner)
    G-->>FE: 잔액과 동결 수량
    break 사용 가능 잔액 부족
        FE->>User: 잔액 부족 안내
    end

    %% 3. 서명 2개 (가스 없음, 항상 둘 다 받음)
    FE->>W: 서명 1: RedeemQuote EIP-712 서명 요청
    W-->>FE: customerSignature
    FE->>G: nonces(owner), name()
    G-->>FE: permit nonce, 토큰 이름
    FE->>W: 서명 2: KGLD Permit EIP-712 서명 요청
    W-->>FE: permitData

    %% 4. 서버 제출 (주문 생성 + 잠금 전송)
    FE->>S: POST /api/redeem/quote/{quoteId}/submit<br/>{customerSignature, permitData}
    S->>CT: redeemLock
    CT-->>S: txHash
    S-->>FE: 주문 번호, txHash, status
    alt 제출 성공
        FE->>User: 상환 신청 접수
    else 견적 만료 또는 전송 실패
        FE->>User: 실패 사유와 다시 시도 안내
    end

    %% 5. 주문 상태 조회
    loop 주문 목록·상세 화면
        FE->>S: GET /api/user/redeem/orders
        S-->>FE: 주문 목록과 status
    end
    Note over FE,S: 주문 상태를 조회하여 처리 진행 상황을 표시

    %% 6. 고객 취소 (선택)
    opt 취소 가능한 주문
        User->>FE: 취소 요청
        FE->>S: POST /api/redeem/orders/cancel/{redeemUuid}
        S->>CT: cancelRedeemLock
        CT-->>S: 취소 처리 결과
        S-->>FE: 취소 접수
        FE->>User: 취소 진행 상태 표시
    end`;
