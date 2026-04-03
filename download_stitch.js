const fs = require('fs');

const downloads = {
  '1_tailoring_options.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2EzY2I3NzhjNzMwZjQ4NzNhZWNiYmRkMTgxYjA3Njk1EgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086',
  '2_jd_detection.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzgxYTZjODY5MTJmODRiM2ViNjY5ZWM1MmM4NzlmNmRhEgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086',
  '3_alignment_score.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzU4Mzc0NmIzMjJiMjQzZDNhN2NiMDc1ZTY0YjJmOGNkEgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086',
  '4_autofill.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzlkMjMwNjU2NzkwZTQyNGU5MzVmMjViMmI4ODNmYWI5EgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086',
  '5_optimization.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2NkMTFmMmUzM2Q4MjQzMmY5OTcxNWY1ZGMyNmYzNGM5EgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086',
  '6_missing_skills.html': 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Y5NTM1MTBlMTFjNTQxOWQ5ZTdiZjJkMDgwYjQ3NGE4EgsSBxD1q-ev4hgYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjU3NTE3NjAyNzkyMjQ3NDM2OQ&filename=&opi=89354086'
};

async function downloadAll() {
  for (const [filename, url] of Object.entries(downloads)) {
    console.log(`Downloading ${filename}...`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Status ${resp.status}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(`stitch_downloads/${filename}`, buffer);
      console.log(`Saved ${filename}`);
    } catch (e) {
      console.error(`Error downloading ${filename}: ${e.message}`);
    }
  }
}

downloadAll();
