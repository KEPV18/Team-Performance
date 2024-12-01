// ... existing code ...

// دالة لجلب بيانات الإنتاج
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
            taskCount: parseInt(row.c[4]?.v) || 0,
            submittedCount: parseInt(row.c[5]?.v) || 0,
            skippedCount: parseInt(row.c[6]?.v) || 0,
            startedCount: parseInt(row.c[7]?.v) || 0,
            date: row.c[8]?.f || row.c[8]?.v || ''
        })).filter(row => row.name && row.team); // تصفية الصفوف الفارغة

        updateProductionTable(); // Update the table with all data
        updateTeamTasksChart();
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

// ... existing code ...