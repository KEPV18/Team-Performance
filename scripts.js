const apiKey = 'AIzaSyDctNVWQhbsQMEDfJDXI30emaTd8mtviEY';
const sheetId = '1EbKvgMRzVKucfGuIOUqJbfncI194MNGJO-9ZVmIJnIw';

let trackingData;
let teamNames = new Set();

// إضافة متغيرات عالمية لتخزين مراجع الرسوم البيانية
let qualityChart = null;
let tasksChart = null;

let productionData = [];
const PRODUCTION_SHEET_ID = '1LBz_Fn8T5I5n3e_UuqLSN8xYpnL1TBkLGTIjL1LF5QM';
// تحديث المتغير الثابت من Form Responses 1 إلى MORNING
const PRODUCTION_SHEET_NAME = 'MORNING';

// Add new constants
const QUALITY_SHEET_ID = '14JdMNnhvCYmEVxRrnQitz5sjYQenh1pgcrE9Aw_pKR8';
const QUALITY_SHEET_NAME = 'MORNING';

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

async function fetchGoogleSheetData(sheetName, range) {
    const loadingElement = document.querySelector('.loading-container');
    if (loadingElement) {
        console.log("Loading element found");
        loadingElement.classList.remove('hidden'); // Show loading animation
    } else {
        console.error("Loading element not found");
    }

    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}?key=${apiKey}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error fetching data:", errorData);
            return [];
        }

        const data = await response.json();
        
        if (!data || !data.values || !Array.isArray(data.values)) {
            console.error("Invalid data received:", data);
            return [];
        }
        return data.values;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    } finally {
        if (loadingElement) {
            loadingElement.classList.add('hidden'); // Hide loading animation
        }
    }
}

async function populateTeamSelect() {
    try {
        const data = await fetchGoogleSheetData("tracking(M)", "B3:B1000");

        if (!data || !Array.isArray(data)) {
            console.error("Data is not an array or is missing:", data);
            return;
        }

        data.forEach(row => {
            if (row[0]) {
                teamNames.add(row[0]);
            }
        });

        trackingData = await fetchGoogleSheetData("tracking(M)", "A1:Z1000");
        if (!trackingData) {
            console.error("Failed to fetch tracking data.");
            return;
        }

        initializeTeamSlider();
    } catch (error) {
        console.error("Error fetching or processing data:", error);
    }
}

async function updateTable(team) {
    const selectedTeam = team || (document.getElementById("teamSelect") ? document.getElementById("teamSelect").value : null);
    const teamTableBody = document.getElementById("teamTableBody");
    const loader = document.querySelector('.loading-container');

    if (!selectedTeam) {
        if (teamTableBody) {
            teamTableBody.innerHTML = '<tr><td colspan="7">Please select a team.</td></tr>';
        }
        return;
    }

    if (loader) {
        loader.classList.remove('hidden'); // Show loading animation
    }

    trackingData = await fetchGoogleSheetData("tracking(M)", "A1:Z1000");

    if (loader) {
        loader.classList.add('hidden'); // Hide loading animation
    }
    if (teamTableBody) {
        teamTableBody.innerHTML = '';
    }

    if (!trackingData) {
        console.error("Failed to fetch tracking data.");
        return;
    }

    // Filter and sort the data based on qualityForAll
    const currentTeamData = trackingData.filter(row => row[1] === selectedTeam)
        .map(row => ({
            device: row[0] || "N/A",
            email: row[2] || "N/A",
            name: row[5] || "N/A",
            tasksCompleted: parseFloat(row[13]) || 0,
            quality: parseFloat(row[12]) || 0,
            qualityForAll: parseFloat(row[7]) || 0,
            lastTaskLink: row[24] || ""
        }))
        .sort((a, b) => {
            const qualityA = parseFloat(a.qualityForAll) || 0;
            const qualityB = parseFloat(b.qualityForAll) || 0;
            return qualityB - qualityA;
        });

    // Find top performers only if they have values greater than 0
    const topTasksPerson = currentTeamData.reduce((max, current) => {
        if (current.tasksCompleted <= 0) return max;
        return (!max || current.tasksCompleted > max.tasksCompleted) ? current : max;
    }, null);

    const topQualityPerson = currentTeamData.reduce((max, current) => {
        if (current.quality <= 0) return max;
        return (!max || current.quality > max.quality) ? current : max;
    }, null);

    // Add sorted data to the table
    currentTeamData.forEach((member, index) => {
        const rowElement = document.createElement("tr");
        const tasksColor = member.tasksCompleted < 60 ? 'red' : 'green';
        const qualityColor = member.quality < 75 ? 'red' : 'green';

        // Add emojis for top performers
        let performanceEmojis = '';
        let shouldShowBalloons = false;

        if (topTasksPerson && member.name === topTasksPerson.name) {
            performanceEmojis += ' 🏆';
            shouldShowBalloons = true;
        }
        if (topQualityPerson && member.name === topQualityPerson.name) {
            performanceEmojis += ' ❤️';
            shouldShowBalloons = true;
        }

        // New medal system with ranking text for top 3
        let rankDisplay = '';
        if (index === 0) {
            rankDisplay = '<span style="color: #FFD700;">🥇 1st</span>';
            shouldShowBalloons = true;
        } else if (index === 1) {
            rankDisplay = '<span style="color: #C0C0C0;">🥈 2nd</span>';
            shouldShowBalloons = true;
        } else if (index === 2) {
            rankDisplay = '<span style="color: #CD7F32;">🥉 3rd</span>';
            shouldShowBalloons = true;
        }

        rowElement.innerHTML = `
            <td>${member.device}</td>
            <td>${member.email}</td>
            <td><span style="display: inline-flex; align-items: center;">${member.name}<span style="margin-left: 4px">${performanceEmojis}</span></span></td>
            <td>${member.qualityForAll}% ${rankDisplay}</td>
            <td style="color: ${tasksColor};">${member.tasksCompleted}</td>
            <td style="color: ${qualityColor};">${member.quality}%</td>
            <td>
                ${member.lastTaskLink ? `<button onclick="copyToClipboard('${member.lastTaskLink}')" class="copy-button">
                    <i class="fas fa-copy"></i> Copy Last Task
                </button>` : 'N/A'}
            </td>
        `;
        rowElement.classList.add('fade-in');
        teamTableBody.appendChild(rowElement);

        // Add animation with balloon effect
        setTimeout(() => {
            rowElement.classList.add('visible');
            if (shouldShowBalloons) {
                showRandomBalloons();
            }
        }, index * 100);
    });

    // Calculate active members and their averages
    const activeMembers = currentTeamData.filter(member => member.tasksCompleted > 1 || member.quality > 1);
    const totalTasks = activeMembers.reduce((sum, member) => sum + member.tasksCompleted, 0);
    const averageTasks = activeMembers.length > 0 ? (totalTasks / activeMembers.length).toFixed(2) : 0;

    // استخدام نفس دالة حساب متوسط الجودة المستخدمة في السلايدر
    const filteredTeamData = trackingData.filter(row => row[1] === selectedTeam);
    const averageQualityForAll = calculateAverageQuality(filteredTeamData, 12);

    // Append summary row
    const summaryRow = document.createElement("tr");
    summaryRow.innerHTML = `
        <td colspan="3">Active Members: ${activeMembers.length}</td>
        <td colspan="2">Average Tasks: ${averageTasks}</td>
        <td colspan="2">Average Quality per Day: ${averageQualityForAll}</td>
    `;
    teamTableBody.appendChild(summaryRow);

    // Update stats only if elements exist
    const performanceStats = calculateTeamStats(trackingData);
    
    // Update Top Team - Add null checks
    const topTeamText = document.getElementById('topTeamText');
    const teamRanking = document.getElementById('teamRanking');
    const topThreeTasks = document.getElementById('topThreeTasks');
    const topThreeQuality = document.getElementById('topThreeQuality');

    const topTeam = Object.entries(performanceStats)
        .sort((a, b) => b[1].averageQuality - a[1].averageQuality)[0];
    if (topTeamText) {
        topTeamText.textContent = topTeam ? topTeam[0] : "N/A";
    }
    
    // Update Team Ranking
    if (teamRanking) {
        teamRanking.textContent = 
            `${selectedTeam}: ${performanceStats[selectedTeam]?.averageQuality.toFixed(2) || "N/A"}`;
    }

    // Get all teams' data for comparison
    const allTeamsData = [];
    for (const teamName of teamNames) {
        const teamData = trackingData.filter(row => row[1] === teamName)
            .map(row => ({
                device: row[0] || "N/A",
                team: row[1] || "N/A",
                email: row[2] || "N/A",
                name: row[5] || "N/A",
                tasksCompleted: parseFloat(row[13]) || 0,
                quality: parseFloat(row[12]) || 0,
                qualityForAll: parseFloat(row[7]) || 0,
                lastTaskLink: row[24] || ""
            }))
            .filter(member => member.tasksCompleted > 0 || member.quality > 0);
        allTeamsData.push(...teamData);
    }

    // Sort by tasks and quality to get top 3 across all teams
    const topTasksAcrossTeams = allTeamsData
        .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
        .slice(0, 3);

    const topQualityAcrossTeams = allTeamsData
        .sort((a, b) => b.quality - a.quality)
        .slice(0, 3);

    // Update Top 3
    if (topThreeTasks) {
        topThreeTasks.textContent = 
            topTasksAcrossTeams.map(m => m.name).join(", ") || "N/A";
    }
    if (topThreeQuality) {
        topThreeQuality.textContent = 
            topQualityAcrossTeams.map(m => m.name).join(", ") || "N/A";
    }

    // Only call these functions if the table exists
    if (teamTableBody) {
        calculateTeamPerformance();
        calculateIndividualPerformance();
    }

    // Auto-refresh the table every minute to keep rankings updated
    setTimeout(updateTable, 300000);

    updateTopPerformers(currentTeamData);
}

function showRandomBalloons() {
    const balloonCount = Math.floor(Math.random() * 21) + 20;
    
    // إزالة البالونات القديمة
    const existingBalloons = document.querySelectorAll('.balloon');
    existingBalloons.forEach(balloon => balloon.remove());

    const symbols = [
        '🎈', '🎉', '✨', '🎊', '🏆', '⭐', '🌟',
        '👑', '💫', '🎯', '💪', '✅', '🔥'
    ];

    let container = document.getElementById('balloons-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'balloons-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999999;
            overflow: hidden;
            will-change: transform;
        `;
        document.body.appendChild(container);
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    for (let i = 0; i < balloonCount; i++) {
        setTimeout(() => {
            const balloon = document.createElement('div');
            balloon.className = 'balloon';
            balloon.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];
            
            const startX = Math.random() * (viewportWidth - 40) + 20;
            const startY = viewportHeight + 10;

            balloon.style.cssText = `
                position: fixed;
                left: ${startX}px;
                top: ${startY}px;
                font-size: ${Math.random() * 10 + 20}px;
                opacity: 0;
                transform: translate(-50%, -50%);
                transition: all 0.3s ease-out;
                z-index: 999999;
                text-shadow: 0 0 5px rgba(0,0,0,0.3);
            `;

            container.appendChild(balloon);

            requestAnimationFrame(() => {
                balloon.style.opacity = '1';
                balloon.style.top = `${Math.random() * (viewportHeight/2)}px`;
                balloon.style.left = `${startX + (Math.random() - 0.5) * 50}px`;
            });

            setTimeout(() => {
                balloon.style.opacity = '0';
                setTimeout(() => balloon.remove(), 300);
            }, 4000);
        }, i * 50);
    }
}

function copyToClipboard(link) {
    navigator.clipboard.writeText(link).then(() => {
        showNotification("Link copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy link: ", err);
    });
}

function showNotification(message) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.style.display = 'block';
    notification.classList.add('show');

    setTimeout(() => {
        notification.style.display = 'none';
        notification.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

function calculateTeamPerformance() {
    const performanceData = {};

    teamNames.forEach(team => {
        performanceData[team] = {
            tasksCompleted: 0,
            quality: 0,
            activeMembers: 0,
            averageTasks: 0,
            averageQuality: 0
        };

        trackingData.forEach(row => {
            if (row[1] === team) {
                const tasksCompleted = parseInt(row[13]) || 0;
                const quality = parseInt(row[12]) || 0;

                if (tasksCompleted > 1 && quality > 1) {
                    performanceData[team].tasksCompleted += tasksCompleted;
                    performanceData[team].quality += quality;
                    performanceData[team].activeMembers++;
                }
            }
        });

        if (performanceData[team].activeMembers > 0) {
            performanceData[team].averageTasks = performanceData[team].tasksCompleted / performanceData[team].activeMembers;
            performanceData[team].averageQuality = performanceData[team].quality / performanceData[team].activeMembers;
        }
    });

    updateTeamLeaderboard(performanceData);
}

function updateTeamLeaderboard(performanceData) {
    const leaderboard = document.getElementById("leaderboard");
    if (!leaderboard) {
        console.warn("Leaderboard element not found. Skipping leaderboard update.");
        return;
    }
    leaderboard.innerHTML = '';

    const sortedTeams = Object.keys(performanceData).sort((a, b) => {
        const teamA = performanceData[a];
        const teamB = performanceData[b];
        return teamB.averageQuality - teamA.averageQuality;
    });

    sortedTeams.forEach(team => {
        const teamInfo = performanceData[team];
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${team}</td>
            <td>${teamInfo.averageTasks.toFixed(2)}</td>
            <td>${teamInfo.averageQuality.toFixed(2)}</td>
        `;
        leaderboard.appendChild(row);
    });
}

function calculateIndividualPerformance() {
    const teamTableBody = document.getElementById("teamTableBody");
    if (!teamTableBody) {
        console.warn("Team table body element not found. Skipping performance calculation.");
        return;
    }

    const rows = Array.from(teamTableBody.getElementsByTagName("tr"));
    
    // Skip the summary row at the end
    const dataRows = rows.slice(0, -1);

    let highestQuality = 0;
    let highestQualityRow = null;

    for (let row of dataRows) {
        // Check if the row has enough cells
        if (!row.cells || row.cells.length < 6) {
            continue;
        }

        const qualityCell = row.cells[5];
        if (!qualityCell) {
            continue;
        }

        const quality = parseFloat(qualityCell.innerText) || 0;

        if (quality > highestQuality) {
            highestQuality = quality;
            highestQualityRow = row;
        }
    }

    if (highestQualityRow) {
        highestQualityRow.classList.add("top-quality");
    }
}

// تحديث دالة حساب إحصائيات الفريق
function calculateTeamStats(data) {
    if (!data || !Array.isArray(data)) {
        return {};
    }

    const stats = {};
    
    Array.from(teamNames).forEach(team => {
        const teamData = data.filter(row => row[1] === team);
        const activeMembers = teamData.filter(member => 
            parseFloat(member[13]) > 1 || parseFloat(member[12]) > 1
        );

        const totalTasks = activeMembers.reduce((sum, member) => 
            sum + (parseFloat(member[13]) || 0), 0
        );
        const averageQualityForAll = calculateAverageQuality(teamData, 12);

        stats[team] = {
            averageTasks: activeMembers.length > 0 ? totalTasks / activeMembers.length : 0,
            averageQuality: parseFloat(averageQualityForAll),
            activeMembers: activeMembers.length
        };
    });
    
    return stats;
}

// دالة مساعدة لساب متسط المهام
function calculateAverageTasks(data) {
    const activeMembers = data.filter(row => parseFloat(row[13]) > 0);
    const totalTasks = activeMembers.reduce((sum, row) => sum + parseFloat(row[13] || 0), 0);
    return activeMembers.length > 0 ? totalTasks / activeMembers.length : 0;
}

// New function to calculate average quality
function calculateAverageQuality(data, columnIndex) {
    const activeMembers = data.filter(row => parseFloat(row[columnIndex]) > 0);
    const totalQuality = activeMembers.reduce((sum, row) => sum + parseFloat(row[columnIndex] || 0), 0);
    return activeMembers.length > 0 ? (totalQuality / activeMembers.length).toFixed(2) : 0;
}

// Add new functions for the slider and tabs
function initializeTeamSlider() {
    const sliderContainer = document.getElementById('teamSlider');
    sliderContainer.innerHTML = '';

    // تحديث إحصائيات الفرق
    const teamsStats = {};
    
    teamNames.forEach(team => {
        const teamData = trackingData.filter(row => row[1] === team);
        const activeMembers = teamData.filter(member => 
            parseFloat(member[13]) > 1 || parseFloat(member[12]) > 1
        );

        const totalTasks = activeMembers.reduce((sum, member) => 
            sum + (parseFloat(member[13]) || 0), 0
        );
        
        const averageQuality = calculateAverageQuality(teamData, 12);

        teamsStats[team] = {
            averageTasks: activeMembers.length > 0 ? totalTasks / activeMembers.length : 0,
            averageQuality: averageQuality,
            activeMembers: activeMembers.length
        };
    });

    teamNames.forEach(team => {
        const stats = teamsStats[team];
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        
        teamCard.innerHTML = `
            <h3>${team}</h3>
            <div class="team-stats">
                <div class="stat-item">
                    <span class="stat-label">Quality Average</span>
                    <span class="stat-value">${stats.averageQuality.toFixed(1)}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Tasks Average</span>
                    <span class="stat-value">${stats.averageTasks.toFixed(1)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Active Members</span>
                    <span class="stat-value">${stats.activeMembers}</span>
                </div>
            </div>
        `;

        teamCard.addEventListener('click', () => {
            document.querySelectorAll('.team-card').forEach(card => 
                card.classList.remove('active')
            );
            teamCard.classList.add('active');
            updateTable(team);
        });

        sliderContainer.appendChild(teamCard);
    });
}

// تأكد من أن هذه الدالة موجودة وتعمل بشكل صحيح
function calculateAverageQuality(teamData, columnIndex) {
    if (!teamData || !teamData.length) return 0;
    
    const validQualityScores = teamData
        .map(row => parseFloat(row[columnIndex]))
        .filter(score => !isNaN(score) && score > 0);

    if (!validQualityScores.length) return 0;
    
    const sum = validQualityScores.reduce((acc, score) => acc + score, 0);
    return sum / validQualityScores.length;
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // تأكد من أن التاب الأول نشط عند بدء التطبيق
    document.getElementById('team-data').classList.add('active');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // إزالة الكلاس النشط من جميع الأزرار
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // إخفء جميع المحتويات
            tabContents.forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });

            // إظهار المحتوى المطلوب
            const targetContent = document.getElementById(button.dataset.tab);
            if (targetContent) {
                targetContent.style.display = 'block';
                targetContent.classList.add('active');
                
                // إذا كان التاب هو metrics، قم بتحديث الرسوم البيانية
                if (button.dataset.tab === 'metrics') {
                    setTimeout(() => {
                        updateMetricsCharts();
                    }, 100);
                }
            }
        });
    });
}

function updateMetricsCharts() {
    // تأكد من وجود العناصر
    const qualityCanvas = document.getElementById('qualityComparisonChart');
    const tasksCanvas = document.getElementById('tasksComparisonChart');
    
    if (!qualityCanvas || !tasksCanvas) {
        console.error('Canvas elements not found');
        return;
    }

    const qualityCtx = qualityCanvas.getContext('2d');
    const tasksCtx = tasksCanvas.getContext('2d');
    
    // تدمير ارسوم البيانية القديمة إذا كانت موجودة
    if (qualityChart) {
        qualityChart.destroy();
    }
    if (tasksChart) {
        tasksChart.destroy();
    }

    // التأكد من وجود البيانات
    if (!trackingData || !teamNames.size) {
        console.error('No data available for charts');
        return;
    }

    const teamsData = {};
    
    // جمع البيانات لكل فريق
    Array.from(teamNames).forEach(team => {
        const teamData = trackingData.filter(row => row[1] === team);
        const activeMembers = teamData.filter(member => 
            parseFloat(member[13]) > 1 || parseFloat(member[12]) > 1
        );

        const totalTasks = activeMembers.reduce((sum, member) => 
            sum + (parseFloat(member[13]) || 0), 0
        );
        const averageQualityForAll = calculateAverageQuality(teamData, 12);

        teamsData[team] = {
            averageTasks: activeMembers.length > 0 ? totalTasks / activeMembers.length : 0,
            averageQuality: parseFloat(averageQualityForAll)
        };
    });

    // إعداد البيانات للرسوم البيانية
    const teams = Object.keys(teamsData);
    const qualityData = teams.map(team => teamsData[team].averageQuality);
    const tasksData = teams.map(team => teamsData[team].averageTasks);

    // إنشاء الرسوم البيانية
    createCharts(qualityCtx, tasksCtx, teams, qualityData, tasksData);
    updateMetricsTable(teamsData);
}

// دالة مساعدة لإنشاء الرسوم البيانية
function createCharts(qualityCtx, tasksCtx, teams, qualityData, tasksData) {
    // مصفوفة ثابتة ن الألوان
    const predefinedColors = [
        '#FFCE56',
         // أحمر فاتح // أزرق
        '#36A2EB',
        '#FF6384', // أصفر
        '#4BC0C0', // فيروزي
        '#9966FF', // بنفسجي
        '#FF9F40', // برتقالي
        '#00CC99', // أخضر زمردي
        '#FF99CC', // وردي
        '#99CCFF', // أزرق فاتح
        '#FF99FF'  // وردي فاتح
    ];

    // استخدام الألوان المحددة مسبقاً مع التكرار إذا كان هناك فرق أكثر من الألوان
    const colors = teams.map((_, index) => predefinedColors[index % predefinedColors.length]);

    const chartConfig = {
        type: 'bar',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333333' },
                    ticks: { color: '#e0e0e0' }
                },
                x: {
                    grid: { color: '#333333' },
                    ticks: { color: '#e0e0e0' }
                }
            }
        }
    };

    qualityChart = new Chart(qualityCtx, {
        ...chartConfig,
        data: {
            labels: teams,
            datasets: [{
                label: 'Average Quality',
                data: qualityData,
                backgroundColor: colors
            }]
        }
    });

    tasksChart = new Chart(tasksCtx, {
        ...chartConfig,
        data: {
            labels: teams,
            datasets: [{
                label: 'Average Tasks',
                data: tasksData,
                backgroundColor: colors
            }]
        }
    });
}

// دالة مساعدة لتحديث جدول المقارنة
function updateMetricsTable(teamsData) {
    const tableBody = document.querySelector('.metrics-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const sortedTeams = Object.entries(teamsData)
        .sort(([, a], [, b]) => b.averageTasks - a.averageTasks);

    sortedTeams.forEach(([team, data], index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}. ${team}</td>
            <td>${data.averageTasks.toFixed(2)}</td>
            <td>${data.averageQuality.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function initializeTeams() {
    const teamsNav = document.querySelector('.teams-nav');
    teamsNav.innerHTML = ''; // Clear existing content

    teamNames.forEach(team => {
        const teamButton = document.createElement('button');
        teamButton.className = 'team-button';
        teamButton.textContent = team;
        teamButton.addEventListener('click', () => {
            document.querySelectorAll('.team-button').forEach(btn => btn.classList.remove('active'));
            teamButton.classList.add('active');
            updateTable(team);
        });
        teamsNav.appendChild(teamButton);
    });
}

// Update initialize function
async function initialize() {
    await populateTeamSelect();
    await updateTopPerformersOnLoad();
    initializeTeamSlider();
    initializeTabs();
    updateTable();
}
initialize();

document.addEventListener('DOMContentLoaded', function() {
    // الحول على بيانات الجدول
    const table = document.querySelector('table');
    const teamData = {};
    
    // تجميع بيانات الفرق من الجدول
    table.querySelectorAll('tr').forEach((row, index) => {
        if (index === 0) return; // تخط�� صف العناوين
        
        const columns = row.querySelectorAll('td');
        const teamName = columns[0].textContent;
        const avgTasks = columns[1].textContent;
        const avgQuality = columns[2].textContent;
        
        teamData[teamName] = {
            avgTasks,
            avgQuality
        };
    });
    
    // إضافة إحصائيات لكل بطاقة فريق
    document.querySelectorAll('.team-card').forEach(card => {
        const teamName = card.querySelector('h3').textContent;
        const data = teamData[teamName];
        
        if (data) {
            const stats = document.createElement('div');
            stats.className = 'team-stats';
            stats.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">متوسط المهام</span>
                    <span class="stat-value">${data.avgTasks}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">متوسط الجودة</span>
                    <span class="stat-value">${data.avgQuality}</span>
                </div>
            `;
            card.appendChild(stats);
        }
    });
});

function showLoading() {
    const loader = document.querySelector('.loading-container');
    loader.classList.remove('hidden');
}

function hideLoading() {
    const loader = document.querySelector('.loading-container');
    loader.classList.add('hidden');
}

// استخدام الدالتين عند الحاجة
// مثال:
async function fetchData() {
    showLoading();
    try {
        // ... عملية تحميل البيانات
        await someAsyncOperation();
    } finally {
        hideLoading();
    }
}

// تحسين أنماط CSS
const style = document.createElement('style');
style.textContent = `
    .balloon {
        user-select: none;
        pointer-events: none;
        transform-origin: center;
        animation: floatSimple 2s ease-in-out infinite;
        will-change: transform, opacity;
        filter: drop-shadow(0 0 2px rgba(255,255,255,0.3));
    }

    @keyframes floatSimple {
        0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
        50% { transform: translate(-50%, -50%) rotate(5deg); }
    }
`;
document.head.appendChild(style);