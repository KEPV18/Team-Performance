async function fetchProductionData() {
    try {
        showLoading();
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${PRODUCTION_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${PRODUCTION_SHEET_NAME}`);
        const text = await response.text();
        const data = JSON.parse(text.substring(47).slice(0, -2));
        
        // تحويل البيانات إلى تنسيق أكثر سهولة للاستخدام
        productionData = data.table.rows.map(row => ({
            name: row.c[0]?.v || '',
            team: row.c[1]?.v || '',
            email: row.c[2]?.v || '',
            status: row.c[3]?.v || '',
            accuracy: '', // سيتم تحديثه لاحقاً من accuracyMap
            taskCount: parseInt(row.c[4]?.v) || 0,
            submittedCount: parseInt(row.c[5]?.v) || 0,
            skippedCount: parseInt(row.c[6]?.v) || 0,
            startedCount: parseInt(row.c[7]?.v) || 0,
            date: row.c[8]?.f || row.c[8]?.v || ''
        })).filter(row => row.name && row.team); // تصفية الصفوف الفارغة

        console.log(productionData); // طباعة البيانات للتحقق منها

        updateProductionTable(); // Update the table with all data
        updateTeamTasksChart();
        updateTeamQualityChart();
      

    } catch (error) {
        console.error('Error fetching production data:', error);
    } finally {
        hideLoading();
    }
}

// تعديل دالة تحديث الجدول لتصفية البيانات حسب الفريق
async function updateProductionTable(selectedTeam = null) {
    const tbody = document.getElementById('productionTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // تصفية البيانات حسب الفريق المحدد
    const filteredData = selectedTeam ? productionData.filter(member => member.team === selectedTeam) : productionData;

    // Fetch accuracy data
    const accuracyMap = await fetchAccuracyData();

    // Fetch average quality data

    // تقسيم البيانات إلى مجموعتين: مع أكيروسي وبدون أكيروسي
    const withAccuracy = filteredData.filter(member => accuracyMap[member.email.toLowerCase()] && accuracyMap[member.email.toLowerCase()] !== 'N/A');
    const withoutAccuracy = filteredData.filter(member => !(accuracyMap[member.email.toLowerCase()] && accuracyMap[member.email.toLowerCase()] !== 'N/A'));

    // ترتيب الأشخاص الذين لديهم أكيروسي
    const sortedWithAccuracy = withAccuracy.sort((a, b) => {
        const accuracyA = parseFloat(accuracyMap[a.email.toLowerCase()]) || 0;
        const accuracyB = parseFloat(accuracyMap[b.email.toLowerCase()]) || 0;
        return accuracyB - accuracyA; // ترتيب تنازلي
    });

    // ترتيب الأشخاص الذين ليس لديهم أكيروسي بناءً على عدد المهام
    const sortedWithoutAccuracy = withoutAccuracy.sort((a, b) => (b.taskCount || 0) - (a.taskCount || 0));

    // دمج القائمتين
    const sortedData = [...sortedWithAccuracy, ...sortedWithoutAccuracy];

    // إنشاء صفوف الجدول
    sortedData.forEach((row, index) => {
        const accuracy = accuracyMap[row.email.toLowerCase()] || 'No Data';
        const accuracyColor = accuracy !== 'No Data' && parseFloat(accuracy) < 75 ? 'red' : 'green';
        
        let rankDisplay = '';
        if (index === 0) rankDisplay = '🥇';
        else if (index === 1) rankDisplay = '🥈';
        else if (index === 2) rankDisplay = '🥉';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center">${index + 1} ${rankDisplay}</td>
            <td style="text-align: left">${row.name || ''}</td>
            <td style="text-align: left">${row.team || ''}</td>
            <td style="text-align: left">${row.email || ''}</td>
            <td style="text-align: center">${row.status || ''}</td>
            <td style="text-align: center; color: ${accuracyColor}; font-weight: bold;">
                ${accuracy}
            </td>
            <td style="text-align: center">${row.taskCount || '0'}</td>
            <td style="text-align: center">${row.submittedCount || '0'}</td>
            <td style="text-align: center">${row.skippedCount || '0'}</td>
            <td style="text-align: center">${row.startedCount || '0'}</td>
            <td style="text-align: center">${row.date || ''}</td>
        `;
        tbody.appendChild(tr);
    });

    // تحديث صف الملخص
    const summaryRow = document.createElement('tr');
    summaryRow.classList.add('summary-row');
    summaryRow.innerHTML = `
        <td colspan="5" style="text-align: right; font-weight: bold;">
            Totals (Active Members: ${filteredData.length})
        </td>
        <td style="text-align: center; font-weight: bold; background-color: rgba(255, 255, 255, 0.1);">
            ${filteredData.reduce((sum, row) => sum + row.taskCount, 0)}
        </td>
        <td style="text-align: center; font-weight: bold; background-color: rgba(255, 255, 255, 0.1);">
            ${filteredData.reduce((sum, row) => sum + row.submittedCount, 0)}
        </td>
        <td style="text-align: center; font-weight: bold; background-color: rgba(255, 255, 255, 0.1);">
            ${filteredData.reduce((sum, row) => sum + row.skippedCount, 0)}
        </td>
        <td style="text-align: center; font-weight: bold; background-color: rgba(255, 255, 255, 0.1);">
            ${filteredData.reduce((sum, row) => sum + row.startedCount, 0)}
        </td>
        <td></td>
    `;
    tbody.appendChild(summaryRow);
}

function calculateTeamAverages() {
    const teamStats = {};
    
    productionData.forEach(member => {
        if (!teamStats[member.team]) {
            teamStats[member.team] = {
                totalSubmitted: 0,
                totalTasks: 0,
                activeMembers: 0,
                totalMembers: 0,
                members: []
            };
        }
        
        teamStats[member.team].totalMembers++;
        
        if (member.submittedCount > 0 || member.taskCount > 0) {
            teamStats[member.team].totalSubmitted += member.submittedCount;
            teamStats[member.team].totalTasks += member.taskCount;
            teamStats[member.team].activeMembers++;
            teamStats[member.team].members.push(member);
        }
    });

    // حساب المتوسطات
    Object.keys(teamStats).forEach(team => {
        const stats = teamStats[team];
        stats.averageSubmitted = stats.activeMembers > 0 
            ? stats.totalSubmitted / stats.activeMembers 
            : 0;
        stats.averageTasks = stats.activeMembers > 0 
            ? stats.totalTasks / stats.activeMembers 
            : 0;
    });

    return teamStats;
}

// دالة رسم بياني للكوالتي 




async function createTeamQualityChart() {
    try {
        // احصل على بيانات الجودة من جدول المقاييس
        const qualityData = await calculateTeamQuality(); // احصل على بيانات الجودة
        const teamData = Object.keys(qualityData).map(team => ({
            team,
            avgQuality: qualityData[team].averageQuality,
            avgTasks: qualityData[team].totalTasks / qualityData[team].activeMembers || 0 // حساب متوسط المهام
        }));

        // استخراج البيانات للرسم البياني
        const labels = teamData.map(item => item.team); // أسماء الفرق
        const avgQuality = teamData.map(item => item.avgQuality); // متوسط الجودة
        const avgTasks = teamData.map(item => item.avgTasks); // متوسط المهام
        
        // عنصر الرسم البياني
        const ctx = document.getElementById('teamQualityChart').getContext('2d');
        if (window.teamQualityChart) {
            window.teamQualityChart.destroy(); // تدمير الرسم البياني السابق إذا كان موجودًا
        }

        // إنشاء الرسم البياني
        window.teamQualityChart = new Chart(ctx, {
            type: 'radar', // نوع الرسم البياني: Radar لإظهار البيانات بشكل مبتكر
            data: {
                labels: labels, // أسماء الفرق
                datasets: [
                    {
                        label: 'Average Quality (%)',
                        data: avgQuality,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(54, 162, 235, 1)'
                    },
                    {
                        label: 'Average Tasks',
                        data: avgTasks,
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(255, 99, 132, 1)'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    r: { // محور الرادار
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        pointLabels: {
                            font: { size: 14 }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating the chart:", error);
    }
}





// تحديث دالة تحديث الرسم البياني
function updateTeamTasksChart() {
    const ctx = document.getElementById('teamTasksChart');
    if (!ctx) return;

    // تجميع البيانات حسب الفريق
    const teamStats = {};
    
    productionData.forEach(row => {
        const team = row.team;
        const taskCount = parseFloat(row.taskCount) || 0;
        
        if (!teamStats[team]) {
            teamStats[team] = {
                totalTasks: 0,
                activeMembers: 0,
                totalMembers: 0
            };
        }
        
        teamStats[team].totalMembers++;
        
        // اعتبار العضو نشطًا فقط إذا كان لديه تاسكات أكثر من صفر
        if (taskCount > 0) {
            teamStats[team].totalTasks += taskCount;
            teamStats[team].activeMembers++;
        }
    });

    // تحويل البيانات إلى مصفوفة وحساب المتوسطات
    const teamData = Object.entries(teamStats).map(([team, stats]) => ({
        team,
        averageTasks: stats.activeMembers > 0 ? (stats.totalTasks / stats.activeMembers).toFixed(2) : '0.00',
        totalTasks: stats.totalTasks,
        activeMembers: stats.activeMembers,
        totalMembers: stats.totalMembers
    }));

    // ترتيب الفرق حسب المتوسط
    teamData.sort((a, b) => parseFloat(b.averageTasks) - parseFloat(a.averageTasks));

    // تحديث الرسم البياني
    const labels = teamData.map(item => item.team);
    const data = teamData.map(item => parseFloat(item.averageTasks));

    // تعريف qualityValues هنا
    const qualityData = calculateTeamQuality(); // احصل على بيانات الجودة
    const qualityValues = Object.keys(qualityData).map(team => {
        return qualityData[team].activeMembers > 0 
            ? (qualityData[team].totalQuality / qualityData[team].activeMembers).toFixed(2) 
            : '0.00';
    });

    const teamColors = [
        '#FF6B6B','#45B7D1', '#96CEB4', '#FFEEAD',
        '#D4A5A5', '#9E9E9E', '#58B19F', '#FFD93D', '#FF8A5B'
    ];

    if (window.teamTasksChart instanceof Chart) {
        window.teamTasksChart.destroy();
    }

    window.teamTasksChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Tasks',
                data: data,
                backgroundColor: teamColors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#ffffff' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#ffffff' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // تحديث الرسم البياني للجودة
    const qualityCtx = document.getElementById('teamQualityChart'); // تأكد من وجود عنصر canvas للرسم البياني للجودة
    if (qualityCtx) {
        if (window.teamQualityChart instanceof Chart) {
            window.teamQualityChart.destroy();
        }

        window.teamQualityChart = new Chart(qualityCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(qualityData),
                datasets: [{
                    label: 'Average Quality',
                    data: qualityValues,
                    backgroundColor: teamColors.slice(0, Object.keys(qualityData).length)
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#ffffff' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#ffffff' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // تحديث جدول المقاييس
    updateTeamMetricsTable(teamData, qualityData);
}

// تحديث دالة تحديث جدول المقاييس
async function updateTeamMetricsTable() {
    const tbody = document.getElementById('teamMetricsBody');
    if (!tbody) {
        console.error('Team metrics table body not found');
        return;
    }

    tbody.innerHTML = '';

    // حساب البيانات لكل فريق
    const teamStats = calculateTeamAverages(); // احصل على متوسطات الفريق
    const qualityData = await calculateTeamQuality(); // احصل على متوسط الجودة

    Object.keys(teamStats).forEach(team => {
        const stats = teamStats[team];
        const quality = qualityData[team] ? qualityData[team].averageQuality : '0.00'; // استخدام المتوسط المحسوب
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${team}</td>
            <td>${stats.averageTasks}</td>
            <td style="color: var(--accent-color); font-weight: bold;">${stats.totalTasks}</td>
            <td style="color: var(--primary-color); font-weight: bold;">${stats.activeMembers} / ${stats.totalMembers}</td>
            <td>${quality}%</td>
        `;
        tbody.appendChild(row);
    });

    // تحديث الرسم البياني للكوالتي بعد تحديث الجدول
    await createTeamQualityChart(); // تأكد من استدعاء الدالة بعد تحديث الجدول
}

// تعديل دالة حساب متوسط الجودة لكل فريق
async function calculateTeamQuality() {
    const qualityData = {};
    const accuracyMap = await fetchAccuracyData();
    
    productionData.forEach(member => {
        if (!qualityData[member.team]) {
            qualityData[member.team] = {
                totalQuality: 0,
                activeMembers: 0,
                totalMembers: 0
            };
        }
        
        qualityData[member.team].totalMembers++;
        
        const accuracy = accuracyMap[member.email.toLowerCase()];
        if (accuracy && accuracy !== 'No Data') {
            const qualityValue = parseFloat(accuracy);
            if (!isNaN(qualityValue)) {
                qualityData[member.team].totalQuality += qualityValue;
                qualityData[member.team].activeMembers++;
            }
        }
    });

    // التأكد من حساب المتوسطات بشكل صحيح
    Object.keys(qualityData).forEach(team => {
        const stats = qualityData[team];
        stats.averageQuality = stats.activeMembers > 0 
            ? (stats.totalQuality / stats.activeMembers).toFixed(2) 
            : '0.00';
    });

    return qualityData; // إرجاع بيانات الجودة
}

// تحديث event listener للتأكد من تحميل البيانات عند تبديل التاب
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            if (tabId === 'production-data') {
                fetchProductionData(); // Fetch all data when opening the tab
            }
        });
    });
    
    // Load data directly if the Production Data tab is active
    if (document.querySelector('[data-tab="production-data"]').classList.contains('active')) {
        fetchProductionData();
    }
});

// Update the fetchAccuracyData function
async function fetchAccuracyData() {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${QUALITY_SHEET_ID}/values/${QUALITY_SHEET_NAME}!A:I?key=${apiKey}`
        );
        const data = await response.json();
        if (!data.values) return {};

        // Create a map of email to accuracy
        const accuracyMap = {};
        data.values.forEach(row => {
            if (row[2] && row[3]) { // Email is in column E (index 4), Accuracy in column I (index 8)
                accuracyMap[row[2].toLowerCase()] = row[3]; // Store accuracy value
            }
        });
        return accuracyMap;
    } catch (error) {
        console.error('Error fetching accuracy data:', error);
        return {};
    }
}

function updateTopPerformers(data) {
    // Get all teams' data for both tasks and quality comparison
    const allTeamsData = [];
    Array.from(teamNames).forEach(teamName => {
        const teamData = trackingData.filter(row => row[1] === teamName)
            .map(row => ({
                name: row[5] || "N/A",
                team: row[1] || "N/A",
                tasksCompleted: parseFloat(row[13]) || 0,
                quality: parseFloat(row[12]) || 0
            }))
            .filter(member => member.tasksCompleted > 0 || member.quality > 0);
        allTeamsData.push(...teamData);
    });

    // ترتيب حسب التاسكات (من جميع الفرق)
    const topTasks = allTeamsData
        .sort((a, b) => parseFloat(b.tasksCompleted) - parseFloat(a.tasksCompleted))
        .slice(0, 3);

    // ترتيب حسب الجودة (من جميع الفرق)
    const topQuality = allTeamsData
        .sort((a, b) => parseFloat(b.quality) - parseFloat(a.quality))
        .slice(0, 3);

    // تحديث ميداليات التاسكات
    const tasksElements = document.querySelectorAll('.medals-section.tasks .medal');
    topTasks.forEach((member, index) => {
        if (tasksElements[index]) {
            const nameEl = tasksElements[index].querySelector('.name');
            const valueEl = tasksElements[index].querySelector('.value');
            if (nameEl && valueEl) {
                nameEl.textContent = member.name;
                valueEl.textContent = `${member.tasksCompleted} tasks`;
            }
        }
    });

    // تحديث ميداليات الجودة
    const qualityElements = document.querySelectorAll('.medals-section.quality .medal');
    topQuality.forEach((member, index) => {
        if (qualityElements[index]) {
            const nameEl = qualityElements[index].querySelector('.name');
            const valueEl = qualityElements[index].querySelector('.value');
            if (nameEl && valueEl) {
                nameEl.textContent = member.name;
                valueEl.textContent = `${member.quality}%`;
            }
        }
    });
}

// Add this new function to update top performers independently
async function updateTopPerformersOnLoad() {
    try {
        // Fetch data if not already loaded
        if (!trackingData) {
            trackingData = await fetchGoogleSheetData("tracking(M)", "A1:Z1000");
        }

        // Get all teams' data for both tasks and quality comparison
        const allTeamsData = [];
        Array.from(teamNames).forEach(teamName => {
            const teamData = trackingData.filter(row => row[1] === teamName)
                .map(row => ({
                    name: row[5] || "N/A",
                    team: row[1] || "N/A",
                    tasksCompleted: parseFloat(row[13]) || 0,
                    quality: parseFloat(row[12]) || 0
                }))
                .filter(member => member.tasksCompleted > 0 || member.quality > 0);
            allTeamsData.push(...teamData);
        });

        // Sort by tasks and quality to get top 3 across all teams
        const topTasks = allTeamsData
            .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
            .slice(0, 3);

        const topQuality = allTeamsData
            .sort((a, b) => b.quality - a.quality)
            .slice(0, 3);

        // Update medals
        updateMedals(topTasks, topQuality);

        // Update text displays if they exist
        const topThreeTasks = document.getElementById('topThreeTasks');
        const topThreeQuality = document.getElementById('topThreeQuality');

        if (topThreeTasks) {
            topThreeTasks.textContent = topTasks.map(m => m.name).join(", ") || "N/A";
        }
        if (topThreeQuality) {
            topThreeQuality.textContent = topQuality.map(m => m.name).join(", ") || "N/A";
        }
    } catch (error) {
        console.error('Error updating top performers:', error);
    }
}

// Helper function to update medals
function updateMedals(topTasks, topQuality) {
    // Update tasks medals
    const tasksElements = document.querySelectorAll('.medals-section.tasks .medal');
    topTasks.forEach((member, index) => {
        if (tasksElements[index]) {
            const nameEl = tasksElements[index].querySelector('.name');
            const valueEl = tasksElements[index].querySelector('.value');
            if (nameEl && valueEl) {
                nameEl.textContent = member.name;
                valueEl.textContent = `${member.tasksCompleted} tasks`;
            }
        }
    });

    // Update quality medals
    const qualityElements = document.querySelectorAll('.medals-section.quality .medal');
    topQuality.forEach((member, index) => {
        if (qualityElements[index]) {
            const nameEl = qualityElements[index].querySelector('.name');
            const valueEl = qualityElements[index].querySelector('.value');
            if (nameEl && valueEl) {
                nameEl.textContent = member.name;
                valueEl.textContent = `${member.quality}%`;
            }
        }
    });
}

//