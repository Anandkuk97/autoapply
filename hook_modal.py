import sys

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'TailoringOptionsModal' not in content:
    content = content.replace('import { CheckCircle2,', 'import { TailoringOptionsModal } from "@/components/TailoringOptionsModal";\nimport { CheckCircle2,')

# 2. Add state
if 'const [tailoringJob, setTailoringJob]' not in content:
    content = content.replace('const [viewingApp, setViewingApp]', 'const [tailoringJob, setTailoringJob] = useState<any>(null);\n  const [viewingApp, setViewingApp]')

# 3. Replace click handlers
content = content.replace("onClick={() => generateForJob(job, 'auto')}", "onClick={() => setTailoringJob(job)}")

# 4. Add modal component at the end
modal_code = """      {/* TAILORING OPTIONS MODAL */}
      <TailoringOptionsModal 
        isOpen={!!tailoringJob} 
        onClose={() => setTailoringJob(null)} 
        onGenerate={(strategy) => {
          generateForJob(tailoringJob, strategy as any);
          setTailoringJob(null);
        }} 
        jobTitle={tailoringJob?.title || ""}
      />
"""
if 'TAILORING OPTIONS MODAL' not in content:
    # Need to find the last </div> before the closing return parenthesis.
    content = content.replace('    </div>\n  );\n}', modal_code + '    </div>\n  );\n}')

with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected modal.")
