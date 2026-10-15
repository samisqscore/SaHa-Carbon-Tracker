/**
 * Utility to convert JSON data to CSV and trigger download
 */
export function downloadCSV(data: any[], filename: string) {
    if (!data || data.length === 0) {
        console.warn("No data to download");
        return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(","), // Header row
        ...data.map(row =>
            headers.map(header => {
                const val = row[header];
                // Handle strings with commas by quoting
                return typeof val === 'string' && val.includes(',')
                    ? `"${val}"`
                    : val;
            }).join(",")
        )
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
