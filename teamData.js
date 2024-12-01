// دالة لجلب بيانات الفريق
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

// دالة لتحديث بيانات الفريق
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

    // ... existing code ...
}

// ... existing code ... 