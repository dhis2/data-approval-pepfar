import api from "../../shared/services/api.service";
import MechanismModel, {MechanismInfo, MechanismMeta, MechanismState} from "../../shared/models/mechanism.model";
import getStatus from "../../shared/services/status.service";
import {getWorkflowTypeById} from "../../shared/services/workflowService";
import getPermittedActions from "../../shared/services/permittedActions.service";

function mechanismStatesUrl(workflow: string, period: string){
    return `/dataApprovals/categoryOptionCombos?wf=${workflow}`
        +`&pe=${period}`;
}

function mechanismsInfoUrl(mechanismIds:string[]){
    let filter;
    if (mechanismIds.length<100) filter = `&filter=categoryOptionCombos.id:in:[${mechanismIds.join(',')}]`;
    else filter = '&filter=categories.id:eq:SH885jaRe0o';
    return `/categoryOptions.json`
        + '?fields=id,name,organisationUnits[id,name],categoryOptionGroups[id,name,groupSets[id]],categoryOptionCombos[id,name]'
        + '&paging=false'
        + filter;
}

function getActionUrl(action){
    switch(action){
        case "submit": return '/dataApprovals/approvals';
        case "accept": return '/dataAcceptances/acceptances';
        case "recall": return '/dataApprovals/unapprovals';
        case "return": return '/dataApprovals/unapprovals';
    }
}

const agencyGroupSet = 'bw8KHXzxd9i';
const partnerGroupSet = 'BOyWrF33hiR';

function getInfoByGroupSet(mechInfo, groupSetId){
    try {
        return mechInfo.categoryOptionGroups.filter(prop => prop.groupSets[0].id === groupSetId)[0] || {};
    } catch(e){
        console.error(e);
        return mechInfo.categoryOptionGroups[0];
    }
}

function replaceOuByGlobal(mechanismsMeta: MechanismMeta[]):MechanismMeta[]{
    let result = JSON.parse(JSON.stringify(mechanismsMeta));
    result.forEach((meta: MechanismMeta) => {
        meta.ou = 'ybg3MO3hcf4';
    });
    return result;
}

function movingUp(action:string):boolean{
    return ['submit','accept'].includes(action);
}

function movingDown(action:string):boolean{
    return ['recall','return'].includes(action);
}

function fixAgencyHq(mechanismsMeta: MechanismMeta[], action:string, currentStatus:string, workflow:string):MechanismMeta[]{
    if (['WUD8TApgOu1','e8F8M6leZjj'].includes(workflow)) {
        if (movingUp(action) && ['accepted by agency hq','submitted by agency hq'].includes(currentStatus)) mechanismsMeta = replaceOuByGlobal(mechanismsMeta);
        if (movingDown(action) && ['submitted by agency hq','accepted by global'].includes(currentStatus)) mechanismsMeta = replaceOuByGlobal(mechanismsMeta);
    }
    return mechanismsMeta;
}

export function performAction(action: string, workflow: string, period: string, mechanismsMeta: MechanismMeta[], currentStatus:string){
    mechanismsMeta = fixAgencyHq(mechanismsMeta, action, currentStatus, workflow);
    return api.post(getActionUrl(action), {
        "approvals": mechanismsMeta.map(m=>{return {"aoc": m.cocId, "ou": m.ou}}),
        "pe": [period],
        "wf": [workflow]
    });
}
function transformCategoryOptionToMechanismInfo(categoryOption:any):MechanismInfo{
    let ouName;
    if (categoryOption.organisationUnits[0]) ouName = categoryOption.organisationUnits[0].name;
    else {
        console.log(categoryOption);
        console.error(Error("Mechanism has no assigned OU"));
    }
    return {
        name: categoryOption.name,
        ou: ouName,
        partner: getInfoByGroupSet(categoryOption, partnerGroupSet).name,
        agency: getInfoByGroupSet(categoryOption, agencyGroupSet).name,
    };
}

export function getMechanismsInfo(mechanismIds: string[]):Promise<MechanismInfo[]>{
    return api.get(mechanismsInfoUrl(mechanismIds)).then(res=>res.categoryOptions)
        .then(categoryOptions=>{
            let result = {};
            categoryOptions.forEach(categoryOption=>{
                result[categoryOption.categoryOptionCombos[0].id] = transformCategoryOptionToMechanismInfo(categoryOption);
            });
            return result;
        })
        .then(mechanismsInfoMap=>{
            return mechanismIds.map(mechanismId=>{
                return mechanismsInfoMap[mechanismId];
            })
        });
}

function transformCOCToMechanismState(workflow, combo){
    let status = getStatus(getWorkflowTypeById(workflow), combo.level.level, combo.accepted);
    return {
        status: status,
        actions: getPermittedActions(combo.permissions, status),
        view: combo.permissions.mayReadData
    }
}

export function getMechanismStates(workflow: string, period: string, mechanisms: MechanismModel[]):Promise<MechanismState>{
    return api.get(mechanismStatesUrl(workflow, period))
        .then(res => {

            return res.filter(categoryOptionCombo=>mechanisms.map(m=>`${m.meta.cocId};${m.meta.ou}`).includes(`${categoryOptionCombo.id};${categoryOptionCombo.ou}`))
        })
        .then(categoryOptionCombos=>categoryOptionCombos.map(coc=>transformCOCToMechanismState(workflow, coc)))
        .then(mechanismStates=>{
            if (mechanismStates.every((val, i, arr)=>JSON.stringify(val)===JSON.stringify(arr[0]))) return mechanismStates[0];
            else throw new Error("Mechanisms have different statuses.");
        });
}
