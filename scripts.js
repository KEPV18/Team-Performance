const apiKey = 'AIzaSyDctNVWQhbsQMEDfJDXI30emaTd8mtviEY';
const sheetId = '1EbKvgMRzVKucfGuIOUqJbfncI194MNGJO-9ZVmIJnIw';

let trackingData;
let teamNames = new Set();

// إضافة متغيرات عالمية لتخزين مراجع الرسوم البيانية
let qualityChart = null;
let tasksChart = null;

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

    // Find top performers (without minimum thresholds)
    const topTasksPerson = currentTeamData.reduce((max, current) => 
        (current.tasksCompleted > (max?.tasksCompleted || -1)) ? current : max
    , null);

    const topQualityPerson = currentTeamData.reduce((max, current) => 
        (current.quality > (max?.quality || -1)) ? current : max
    , null);

    // Add sorted data to the table
    currentTeamData.forEach((member, index) => {
        const rowElement = document.createElement("tr");
        const tasksColor = member.tasksCompleted < 60 ? 'red' : 'green';
        const qualityColor = member.quality < 75 ? 'red' : 'green';

        // Add emojis for top performers without any threshold conditions
        const tasksEmoji = (member.name === topTasksPerson.name) ? ' 🏆' : '';
        const qualityEmoji = (member.name === topQualityPerson.name) ? ' ❤️' : '';

        // Determine rank suffix
        const rankSuffix = (index + 1) === 1 ? 'st' : (index + 1) === 2 ? 'nd' : (index + 1) === 3 ? 'rd' : 'th';
        const rankDisplay = `<span style="color: #daa520;">${index + 1}${rankSuffix} ⭐</span>`;

        rowElement.innerHTML = `
            <td>${member.device}</td>
            <td>${member.email}</td>
            <td>${member.name}${tasksEmoji}${qualityEmoji}</td>
            <td>${member.qualityForAll} ${rankDisplay}</td>
            <td style="color: ${tasksColor};">${member.tasksCompleted}</td>
            <td style="color: ${qualityColor};">${member.quality}</td>
            <td>
                ${member.lastTaskLink ? `<button onclick="copyToClipboard('${member.lastTaskLink}')" class="copy-button">
                    <i class="fas fa-copy"></i> Copy Last Task
                </button>` : 'N/A'}
            </td>
        `;
        rowElement.classList.add('fade-in');
        teamTableBody.appendChild(rowElement);

        setTimeout(() => {
            rowElement.classList.add('visible');
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

    calculateTeamPerformance();
    calculateIndividualPerformance();
    updateTopHeart();
    showRandomBalloons();

    // حذف الجزء القديم واستبداله بهذا
    const performanceStats = calculateTeamStats(trackingData);
    
    // تحديث Top Team
    const topTeam = Object.entries(performanceStats)
        .sort((a, b) => b[1].averageQuality - a[1].averageQuality)[0];
    document.getElementById("topTeamText").textContent = topTeam ? topTeam[0] : "N/A";
    
    // تحديث Team Ranking
    document.getElementById("teamRanking").textContent = 
        `${selectedTeam}: ${performanceStats[selectedTeam]?.averageQuality.toFixed(2) || "N/A"}`;

    // تحديث Top 3
    const topTasksMembers = currentTeamData
        .sort((a, b) => parseFloat(b.tasksCompleted) - parseFloat(a.tasksCompleted))
        .slice(0, 3);
    const topQualityMembers = currentTeamData
        .sort((a, b) => parseFloat(b.quality) - parseFloat(a.quality))
        .slice(0, 3);

    document.getElementById("topThreeTasks").textContent = 
        topTasksMembers.map(m => m.name).join(", ") || "N/A";
    document.getElementById("topThreeQuality").textContent = 
        topQualityMembers.map(m => m.name).join(", ") || "N/A";

    // Auto-refresh the table every minute to keep rankings updated
    setTimeout(updateTable, 300000);
}

function showRandomBalloons() {
    const balloonCount = Math.floor(Math.random() * 26) + 15;
    const balloonContainer = document.querySelectorAll('.balloon');
    const symbols = ['🎈', '❤️', '🎉', '✨', '🎊', '🎁', '💪', '😎', '🏆', '🔥', '💯', '🍾', '🌟'];

    balloonContainer.forEach(balloon => {
        balloon.style.opacity = '0';
    });

    for (let i = 0; i < balloonCount; i++) {
        const balloon = document.createElement('div');
        balloon.className = 'balloon';
        balloon.innerHTML = symbols[Math.floor(Math.random() * symbols.length)];
        balloon.style.position = 'absolute';
        balloon.style.left = Math.random() * 100 + 'vw';
        balloon.style.top = Math.random() * 100 + 'vh';
        balloon.style.opacity = '1';
        balloon.style.transition = 'opacity 0.5s';
        document.body.appendChild(balloon);

        setTimeout(() => {
            balloon.style.transform = `translateY(-${Math.random() * 50 + 50}px)`;
        }, 100);

        setTimeout(() => {
            balloon.style.opacity = '0';
            setTimeout(() => {
                balloon.remove();
            }, 500);
        }, 5000);
    }
}

function updateTopHeart() {
    const teamTableBody = document.getElementById("teamTableBody");
    const rows = teamTableBody.getElementsByTagName("tr");
    
    // تخزين أعلى قيم لكل فريق
    const topPerformers = {
        tasks: { value: 0, row: null },
        quality: { value: 0, row: null }
    };
    
    // البحث عن أعلى القيم
    Array.from(rows).forEach(row => {
        const tasks = parseFloat(row.cells[4].innerText) || 0;
        const quality = parseFloat(row.cells[5].innerText) || 0;
        
        if (tasks > topPerformers.tasks.value) {
            topPerformers.tasks.value = tasks;
            topPerformers.tasks.row = row;
        }
        
        if (quality > topPerformers.quality.value) {
            topPerformers.quality.value = quality;
            topPerformers.quality.row = row;
        }
    });
    
    // إزالة القلوب القديمة
    document.querySelectorAll('.heart').forEach(heart => heart.remove());
    
    // إضافة القلوب الجديدة
    if (topPerformers.tasks.row) {
        const heartTasks = document.createElement('span');
        heartTasks.className = 'heart';
        heartTasks.innerHTML = '❤️';
        topPerformers.tasks.row.cells[2].appendChild(heartTasks);
    }
    
    if (topPerformers.quality.row && topPerformers.quality.row !== topPerformers.tasks.row) {
        const heartQuality = document.createElement('span');
        heartQuality.className = 'heart';
        heartQuality.innerHTML = '❤️';
        topPerformers.quality.row.cells[2].appendChild(heartQuality);
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
        console.error("Leaderboard element not found.");
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
        console.error("Team table body element not found.");
        return;
    }

    const rows = teamTableBody.getElementsByTagName("tr");

    let highestQuality = 0;
    let highestQualityRow = null;

    for (let row of rows) {
        const qualityCell = row.cells[5];
        if (!qualityCell) {
            console.error("Quality cell not found in row.");
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

// دالة مساعدة لحساب متوسط المهام
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

            // إخفاء جميع المحتويات
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
    
    // تدمير الرسوم البيانية القديمة إذا كانت موجودة
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
    // مصفوفة ثابتة من الألوان
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
    initializeTeamSlider();
    initializeTabs();
    updateTable();
}
initialize();

document.addEventListener('DOMContentLoaded', function() {
    // الحصول على بيانات الجدول
    const table = document.querySelector('table');
    const teamData = {};
    
    // تجميع بيانات الفرق من الجدول
    table.querySelectorAll('tr').forEach((row, index) => {
        if (index === 0) return; // تخطي صف العناوين
        
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

