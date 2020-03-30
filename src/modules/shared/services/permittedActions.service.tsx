import {MechanismActions} from "../models/mechanism.model";

type Dhis2Permissions = {
    mayApprove:boolean;
    mayUnapprove:boolean;
    mayAccept:boolean;
    mayUnaccept:boolean;
};

function canRecall(dhis2Permissions:Dhis2Permissions):boolean{
    if (!dhis2Permissions.mayAccept && dhis2Permissions.mayUnapprove) return true;
    else return false;
}

function canReturn(dhis2Permissions:Dhis2Permissions):boolean{
    if (dhis2Permissions.mayAccept && dhis2Permissions.mayUnapprove) return true;
    else return false;
}

export default function getPermittedActions(dhis2permissions:Dhis2Permissions):MechanismActions {
    if (!dhis2permissions) return {};
    return {
        submit: dhis2permissions.mayApprove,
        accept: dhis2permissions.mayAccept,
        recall: canRecall(dhis2permissions),
        return: canReturn(dhis2permissions),
    }
}