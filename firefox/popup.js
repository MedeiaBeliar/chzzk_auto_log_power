let powerTimer = null;
let clockToggle = false;

// 다음 파워 획득 시간 계산
function calculateNextPowerTime() {
    browser.storage.local.get(['powerLogs', 'lastPowerAcquisitionTime']).then((result) => {
        const logs = result.powerLogs || [];
        const lastAcquisitionTime = result.lastPowerAcquisitionTime;
        const now = new Date();
        
        let nextPowerTime;
        
        nextPowerTime = calculateFromLastLog(logs, now, lastAcquisitionTime);
        
        updateTimeDisplay(nextPowerTime);
    }).catch((error) => {
        console.error('Storage error:', error);
        updateTimeDisplay(new Date(Date.now() + 60 * 60 * 1000));
    });
}

// 마지막 로그 기준으로 다음 획득 시간 계산
function calculateFromLastLog(logs, now, lastAcquisitionTime = null) {
    const viewLogs = logs
        .filter(log => log && String(log.method).toLowerCase() === 'view')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const referenceTime = new Date(lastAcquisitionTime || viewLogs[0]?.timestamp);

    if (Number.isNaN(referenceTime.getTime())) {
        const nextHour = new Date(now);
        nextHour.setMinutes(0, 0, 0);
        nextHour.setHours(nextHour.getHours() + 1);
        return nextHour;
    }

    const hourMs = 60 * 60 * 1000;
    let nextTimeMs = referenceTime.getTime() + hourMs;
    if (nextTimeMs <= now.getTime()) {
        nextTimeMs += (Math.floor((now.getTime() - nextTimeMs) / hourMs) + 1) * hourMs;
    }
    return new Date(nextTimeMs);
}

// 시간 표시 업데이트
function updateTimeDisplay(nextPowerTime) {
    const timeDisplay = document.getElementById('timeDisplay');
    const now = new Date();
    const diffMs = nextPowerTime.getTime() - now.getTime();
    
    if (diffMs <= 0) {
        timeDisplay.textContent = '곧 획득 가능';
        return;
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) {
        timeDisplay.textContent = `${hours}시간 ${minutes}분 후`;
    } else {
        timeDisplay.textContent = `${minutes}분 후`;
    }
}

// 타이머 시작
function startPowerTimer() {
    if (powerTimer) {
        clearInterval(powerTimer);
    }
    
    // 즉시 계산
    calculateNextPowerTime();
    
    // 1분마다 업데이트
    powerTimer = setInterval(calculateNextPowerTime, 60 * 1000);
}

// 마지막 파워 획득 시간 저장
function saveLastPowerAcquisitionTime() {
    browser.storage.local.set({ lastPowerAcquisitionTime: new Date().toISOString() });
}

onload = (event) => {
    browser.storage.sync.get(["badge", "clockToggle"]).then((r) => {
        if (r.badge == undefined) {
            r.badge = true;
            browser.storage.sync.set({ badge: true });
        }
        if (r.clockToggle == undefined) {
            r.clockToggle = false;
            browser.storage.sync.set({ clockToggle: false });
        }

        let checkbox = document.getElementById("toggle");
        checkbox.checked = r.badge;
        checkbox.addEventListener("change", () => {
            browser.storage.sync.set({ badge: checkbox.checked });
            // 즉시 content script에 변경사항 전달
            browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes('chzzk.naver.com')) {
                    browser.tabs.sendMessage(tabs[0].id, {
                        action: 'updateBadgeToggle',
                        badgeToggle: checkbox.checked
                    });
                }
            }).catch((error) => {
                console.error("Tabs query error:", error);
            });
        });

        let clockCheckbox = document.getElementById("clockToggle");
        clockCheckbox.checked = r.clockToggle;
        clockToggle = r.clockToggle;
        clockCheckbox.addEventListener("change", () => {
            browser.storage.sync.set({ clockToggle: clockCheckbox.checked });
            clockToggle = clockCheckbox.checked;
            // 즉시 content script에 변경사항 전달
            browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes('chzzk.naver.com')) {
                    browser.tabs.sendMessage(tabs[0].id, {
                        action: 'updateClockToggle',
                        clockToggle: clockCheckbox.checked
                    });
                }
            }).catch((error) => {
                console.error("Tabs query error:", error);
            });
        });
    }).catch((error) => {
        console.error("Storage sync get error:", error);
        // 기본값으로 설정
        let checkbox = document.getElementById("toggle");
        checkbox.checked = true;
        checkbox.addEventListener("change", () => {
            browser.storage.sync.set({ badge: checkbox.checked });
        });
        let clockCheckbox = document.getElementById("clockToggle");
        clockCheckbox.checked = true;
        clockCheckbox.addEventListener("change", () => {
            browser.storage.sync.set({ clockToggle: clockCheckbox.checked });
        });
    });

    // 로그 보기 버튼 이벤트
    document.getElementById("viewLogs").addEventListener("click", () => {
        browser.tabs.create({ url: browser.runtime.getURL("log.html") });
    });
    
    // 파워 타이머 시작
    startPowerTimer();
};

// 파워 획득 시 호출할 함수 (content script에서 메시지로 호출)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'powerAcquired') {
        saveLastPowerAcquisitionTime();
        calculateNextPowerTime();
    }
});
