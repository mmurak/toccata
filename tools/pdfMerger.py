import os
import sys
from PyPDF2 import PdfMerger 
def merge_pdfs(pdf_files, output_filename):
    merger = PdfMerger()
    for pdf_path in pdf_files:
        try:
            merger.append(pdf_path)
            print(f"    -> Added {os.path.basename(pdf_path)}")
        except Exception as e:
            print(f"    Processing Error at '{os.path.basename(pdf_path)}': {e}")

    try:
        with open(output_filename, 'wb') as output_file:
            merger.write(output_file)
        
        print("\n--- Finished ---")
        print(f"Output file name: **{output_filename}**")
    except Exception as e:
        print(f"\nWrit Error: {e}")
    finally:
        merger.close()

merge_pdfs(sys.argv[1:], 'output.pdf')
