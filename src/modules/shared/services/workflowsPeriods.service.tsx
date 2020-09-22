import api from './api.service';
import {idNameList} from "../models/idNameList.model";
import getWorkflows from "./workflowService";

export type WorkflowPeriods = {
   id: string;
   name:string;
   type: string;
   periods: idNameList;
}[];

type periodList = {name: string, id:string, startDate: Date, endDate:Date}[];

function filterPeriods(periods:periodList):idNameList{
    return periods.filter(period=>{
        let today = new Date();
        return today>period.startDate && today<period.endDate;
    });
}

function getPeriods(workflow):periodList{
    return Object.keys(workflow).map(periodId=>{
        let period = workflow[periodId];
        return {
            name: period.name,
            id: periodId,
            startDate: new Date(period.start),
            endDate: new Date(period.end)
        }
    });
}

function transformDatastore(response, isSuperUser):WorkflowPeriods{
    return Object.keys(response).map(workflowName=>{
        let periods:any = getPeriods(response[workflowName]);
        if (!isSuperUser) periods = filterPeriods(periods);
        return {
            id: null,
            name: workflowName,
            periods: periods,
            type: null
        }
    });
}

function checkSuperUser():Promise<boolean>{
    return api.get('/me?fields=userCredentials[userRoles[name]]')
        .then(result=>result.userCredentials.userRoles)
        .then(result=>result.map(r=>r.name))
        .then(result=>result.includes("Superuser ALL authorities"))
}

export default class WorkflowPeriodService {
    private workflowPeriods:WorkflowPeriods;
    async init():Promise<WorkflowPeriods>{
        let isSuperUser:boolean = await checkSuperUser();
        let wfPromise = getWorkflows();
        let wfPeriodPromise = this.fetchDatastorePeriods(isSuperUser);
        return Promise.all([wfPromise, wfPeriodPromise]).then(results=>{
            let workflows:idNameList = results[0];
            let workflowPeriods:WorkflowPeriods = results[1];
            this.workflowPeriods = workflowPeriods.filter(wfp=>{
                return workflows.map(wf=>wf.name).includes(wfp.name);
            }).map(wfp=>{
                wfp.id = workflows.filter(wf=>wf.name===wfp.name)[0].id;
                return wfp;
            }).filter(wfp=>{
                return wfp.periods.length>0;
            });
            this.workflowPeriods.forEach(wfp=>{
                wfp.periods = wfp.periods.sort((a,b)=>a.id>b.id?-1:1);
            })
            return this.workflowPeriods;
        });
    }

    private fetchDatastorePeriods(isSuperUser: boolean){
        return api.get('/dataStore/approvals/periodSettings').then((result)=>transformDatastore(result, isSuperUser));
    }

    getPeriods(workflowId: string):idNameList{
        if (!workflowId) return [];
        return this.workflowPeriods.filter(wf =>wf.id===workflowId)[0].periods;
    }
    getPeriodNameById(workflowId: string, periodId: string):string{
        return this.getPeriods(workflowId).filter(p=>p.id===periodId)[0].name;
    }
}


