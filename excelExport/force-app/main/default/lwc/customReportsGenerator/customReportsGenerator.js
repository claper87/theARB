import { LightningElement } from 'lwc';
import generateReportData from '@salesforce/apex/CustomReportsController.generateReportData';
import getActiveReportOptionList from '@salesforce/apex/CustomReportsController.getActiveReportOptionList';
import getActiveReportConfig from '@salesforce/apex/CustomReportsController.getActiveReportConfig';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';



export default class CustomReportsGenerator extends LightningElement {
    xlsHeaderList;
    filename;
    worksheetNameList;
    xlsData;
    isLoading;
    selectedReportName;
    activeReportOptionList;
    reportsConfig = {};
    reportInitiatedStartTime;
    currentElapsedReportTime = 0;
    intervalId;
    cancelRequest;

    connectedCallback(){
        this.xlsHeaderList = [];
        this.worksheetNameList = [];
        this.xlsData = [];
        this.isLoading = true;

        const activeReportConigPromise = getActiveReportConfig().then((result)=>{
            if(result){
                this.reportsConfig = result;
            }
        }).catch(ex=>{
            console.error(ex);
            this.showToast('Error', ex.body.message, 'error');
        });


        const optionListPromise = getActiveReportOptionList().then((result)=>{
            if(result){
                this.activeReportOptionList = result;
            }
        }).catch(ex=>{
            console.error(ex);
            this.showToast('Error', ex.body.message, 'error');
        });

        

        Promise.all([optionListPromise, activeReportConigPromise]).then(()=>{
            this.isLoading = false;
        }).finally(()=>{    
            this.isLoading = false;
        });
    }

    get lastvalueFromRecordList(){
        return this.xlsData?.length > 0 && this.reportsConfig[this.selectedReportName].IndexFieldLabel ? this.xlsData[this.xlsData.length-1][this.reportsConfig[this.selectedReportName].IndexFieldLabel] : '';
    }

    get selectedReportLabel(){
        return this.selectedReportName ? this.activeReportOptionList?.find( r=> r.value == this.selectedReportName)?.label : 'Please select a custom report definition';
    }
    get reportNotSelected(){
        return !this.selectedReportName;
    }

    get disableDownloadButton(){
        return this.isLoading || this.reportNotSelected;
    }

    get totalRecords(){
        return this.xlsData?.length;
    }

    get elapsedTime(){
        const now = new Date();
        const elapsedMilliseconds = now - this.reportInitiatedStartTime;
        const elapsedSeconds = elapsedMilliseconds / 1000;
        return elapsedSeconds;
    }

    get disableStopButton(){
        return !this.isLoading || this.reportNotSelected;
    }

    get downloadStarted(){
        return this.isLoading;
    }

    startElapsedTimeTracker(){
        this.reportInitiatedStartTime = new Date();
        this.intervalId = setInterval(()=>{
            this.currentElapsedReportTime = this.elapsedTime;
        },1000);
    }
    stopElapsedTimeTracker(){
        clearInterval(this.intervalId);
    }

    get elapsedTimestamp() {
        const hours = Math.floor(this.currentElapsedReportTime / 3600);
        const minutes = Math.floor((this.currentElapsedReportTime % 3600) / 60);
        const remainingSeconds = this.currentElapsedReportTime % 60;
    
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(Math.floor(remainingSeconds)).padStart(2, '0');
    
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    }

    getData(dataFetchedCallback){
        return generateReportData({reportToGenerate : this.selectedReportName, lastValueFromPagination: this.lastvalueFromRecordList})
        .then((result)=>{
            if(this.cancelRequest) return;
            if(result){
                const data = JSON.parse(result);
                if(this.xlsData.length == 0) { 
                    this.xlsData = data;
                }
                else{
                    this.xlsData = this.xlsData.concat(data);
                }

                //without waiting, fetch next chunk of data if chunks is enabled
                if(data.length > 0 &&  this.reportsConfig[this.selectedReportName].ChunksEnabled == true){
                    this.getData(dataFetchedCallback);
                }else{
                    this.stopUIFeedback();
                    if(dataFetchedCallback) dataFetchedCallback();
                }
            }
            //release screen
        }).catch(ex=>{
            console.error(ex);
            this.showToast('Error', ex.body.message, 'error');
            this.stopUIFeedback();
            this.cancelRequest = false;
        }).finally(()=>{
            
        });
    }

    startUIFeedback(){
        this.isLoading = true;
        this.startElapsedTimeTracker();
        this.xlsData = [];
        this.currentElapsedReportTime = 0;
        this.cancelRequest = false;
    }

    stopUIFeedback(){
        this.stopElapsedTimeTracker();
        this.isLoading = false;
    }

    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(evt);
    }

    handleReportNameChange(event){
        this.selectedReportName = event.target.value;
    }

    // formating the data to send as input to  xlsxMain component
    // addDataIntoSheet(data, sheetName) {
    //     if(data.length <= 0){ return; }
    //     let Header = Object.keys(data[0]);
    //     Header.forEach(aHeader=>{
    //         let record = new Function(`return { column:'${aHeader}',type:String, value: entry=>entry['${aHeader}'] } `)();

    //         this.xlsHeaderList.push(record);
    //     });
        
    //     this.worksheetNameList.push(sheetName);
    //     this.xlsData = data;
    // }

    async handleDownloadReport(){
        this.showToast('Info', 'Report generation started', 'info');
        this.startUIFeedback();
        
        try{
            await this.getData(()=>{
                this.template.querySelector('c-excel-generator').downloadExcelXlsx (`${this.selectedReportName}.xlsx`,this.selectedReportName, this.xlsData);
                this.isLoading = false;
            });
            
        }catch(ex){
            console.error(ex);
            this.showToast('Error', ex.body.message, 'error');
            this.stopUIFeedback();
        }
        
    }

    handleStop(){
        this.cancelRequest = true;
        this.stopUIFeedback();
        this.showToast('Info', 'Report generation has been stopped', 'info');
    }
}