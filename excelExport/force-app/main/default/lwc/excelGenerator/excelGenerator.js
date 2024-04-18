import { LightningElement, api } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import xlsxGeneratorRootFolder from "@salesforce/resourceUrl/writeExcelFile";

export default class ExcelGenerator extends LightningElement {
  librariesLoaded = false;
  renderedCallback() {
    if (this.librariesLoaded) return;
    this.librariesLoaded = true;
    Promise.all([loadScript(this, xlsxGeneratorRootFolder + "/writeExcelFile/xlsx.full.min.js")])
      .then((t) => {
        console.log("success");
      })
      .catch(error => {
        console.error(error);
      });
  }

  /*
    @description constructs and output an excel file for the given data.
    @param filename A strong which is the name of the file to be downloaded by the browser.
    @param headerColumnList An array of columns definitions, it tells the system whats the column(s) and where to get the data from.
    @param worksheetNameList An array of string which represents the sheets to include.
    @param sheetsDataList A multi dimensional array, First dimension should be as many sheets to include.
    @returns async
  */
  @api async downloadExcel(filename, headerColumnList, worksheetNameList, sheetsDataList){
    debugger;
    //calling the third party library to generate the excel
    await writeXlsxFile(sheetsDataList, {
        schema: headerColumnList,
        //sheets: worksheetNameList,
        fileName: filename,
        headerStyle: {
            backgroundColor: '#1E2F97',
            fontWeight: 'bold',
            align: 'center',
            color:'#FFFFFF'
        }
    })
  }

  @api downloadExcelXlsx(filename, sheetName, sheetData){
    debugger;
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb,filename);
  }
}