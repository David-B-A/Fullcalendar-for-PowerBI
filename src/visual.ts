/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/


"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;

// import { VisualSettings } from "./settings";

import { Calendar, Component, createElement, DayHeaderContentArg } from '@fullcalendar/core';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

export interface ItemStatus {
    category: string | number,
    color: string,
    selectionID: powerbi.visuals.ISelectionId
}

export class Visual implements IVisual {
    private columnIndices: { "name": string, "index": number, "label": string, "type": string, "indices"?: any[]}[] = [
        { "name": "activity", "index": null, "label": "Activity" , "type": "string"},
        { "name": "planDate", "index": null, "label": "Plan Date", "type": "date"},
        { "name": "realDate", "index": null, "label": "Real Date", "type": "date"},
        { "name": "status", "index": null, "label": "Status", "type": "string"},
        { "name": "url", "index": null, "label": "URL", "type": "string"},
        { "name": "tooltip", "index": null, "label": "Tooltip", "type": "array", "indices": []},
    ];
    private statusIndex: number = 3;

    private host: powerbi.extensibility.visual.IVisualHost;
    private itemStatus: ItemStatus[] = [];
    private fontColor: string;
    private fontSize: number;

    private static CalendarFontColorPropertyIdentifiers: DataViewObjectPropertyIdentifier = {
        objectName: "calendar",
        propertyName: "fontColor"
    }
    private static CalendarFontSizePropertyIdentifiers: DataViewObjectPropertyIdentifier = {
        objectName: "calendar",
        propertyName: "fontSize"
    }
    private static CategoryColorsPropertyIdentifiers: DataViewObjectPropertyIdentifier = {
        objectName: "categoryColors",
        propertyName: "fill"
    }



    private target: HTMLElement;
    private legend: HTMLElement;
    private updateCount: number;
    // private settings: VisualSettings;
    private textNode: Text;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.legend = document.createElement("div");
        this.legend.setAttribute("id", "legend");
        this.target.appendChild(this.legend);
        if (document) {
            const calendarTag: HTMLElement = document.createElement("div");
            calendarTag.setAttribute("id", "calendar");
            this.target.appendChild(calendarTag);
        }
    }

    private dataExtraction(dataView: DataView) {
        let categories = dataView.categorical.categories;
        for (let i = 0; i < this.columnIndices.length; i++) {
            //defining name value from our preconstructed map of names
            let name = this.columnIndices[i].name;
            this.columnIndices[i].index = null;
            if(this.columnIndices[i].type === "array") {
                this.columnIndices[i].indices = [];
            }
            //now iterate over available columns, note that not all columns may be assigned a data field yet
            for (let j = 0; j < categories.length; j++) {
                //defining the role attribute of the current column, more info in the data view appendix
                let columnRoles = categories[j].source.roles;
                //column name is the property name, so looking in there
                if (Object.keys(columnRoles).indexOf(name) >= 0) {
                    if(this.columnIndices[i].type === "array") {
                        this.columnIndices[i].indices.push(j);
                    } else {
                        this.columnIndices[i].index = j;
                        break;
                    }
                    //setting the index of the column name to the index of the role
                }
            }
        }
        let status = categories[this.columnIndices[this.statusIndex].index].values;
        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }
        status = status.filter(onlyUnique);
        let categoryColumn = categories[this.columnIndices[this.statusIndex].index];
        for(let i = 0; i < status.length; i++) {
            let temp = this.itemStatus.filter(item => item.category === status[i]);
            if(temp.length === 0) {
                let tem: ItemStatus = {
                    category: status[i].toString(),
                    color: this.host.colorPalette.getColor(status[i].toString()).value,
                    selectionID: this.host.createSelectionIdBuilder().withCategory(categoryColumn, i)
                    .createSelectionId()
                }
                this.itemStatus.push(tem);
            }
        }
        
    }
    private dataTransforming(dataView: DataView) {
        let categories = dataView.categorical.categories;
        let categoryColumn = categories[this.columnIndices[this.statusIndex].index];
        let data = [] as any[];
        for (let i = 0; i < categoryColumn.values.length; i++) {
            let row = {} as any;
            if(this.columnIndices[0].index !== null) {
                row.title = dataView.categorical.categories[this.columnIndices[0].index].values[i];
            }
            if(this.columnIndices[1].index !== null) {
                row.start = dataView.categorical.categories[this.columnIndices[1].index].values[i].toString().substring(0, 10);
            }
            if(this.columnIndices[this.statusIndex].index !== null) {
                let status = dataView.categorical.categories[this.columnIndices[this.statusIndex].index].values[i].toString();
                row.color = this.itemStatus.filter(x => x.category === status)[0].color;
            }
            if(this.columnIndices[4].index !== null) {
                row.url = dataView.categorical.categories[this.columnIndices[4].index].values[i];
            }
            if(this.columnIndices[5].indices) {
                let tooltip = "";
                for(let j = 0; j < this.columnIndices[5].indices.length; j++) {
                    let k = this.columnIndices[5].indices[j];
                    tooltip += tooltip ? " | " : "";
                    tooltip += dataView.categorical.categories[k].values[i].toString();
                }
                row.description = tooltip;
            }
            data.push(row);
        }
        return data;
    }

    private createLegend() {
        let legend = document.getElementById("legend");
        if(legend) {
            legend.innerHTML = "";
        } else {
            legend = document.createElement("div");
            legend.setAttribute("id", "legend");
            this.target.appendChild(legend);
        }
        legend.innerHTML = "Legend: ";
        legend.style.fontSize = this.fontSize + "px";
        for(let i = 0; i < this.itemStatus.length; i++) {
            let legendItem = document.createElement("div");
            legendItem.style.backgroundColor = this.itemStatus[i].color;
            legendItem.style.display = "inline-block";
            legendItem.style.width = "0.8rem";
            legendItem.style.height = "0.8rem";
            legendItem.style.marginRight = "0.2rem";
            legendItem.style.marginLeft = "0.5rem";
            legend.appendChild(legendItem);
            let legendItemText = document.createElement("div");
            legendItemText.innerHTML = this.itemStatus[i].category.toString();
            legendItemText.style.display = "inline-block";
            legend.appendChild(legendItemText);
        }
    }
    public update(options: VisualUpdateOptions) {
        // this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        let data = [];
        if (options.dataViews.length > 0) {
            this.dataExtraction(options.dataViews[0]);
            this.updateSettings(options.dataViews[0]);
            this.createLegend();
            data = this.dataTransforming(options.dataViews[0]);
        } else {
            return;
        }
        // let FullCalendarJS = (<any>window).FullCalendar;
        let calendarTag = document.getElementById("calendar");

        // let calendar = new FullCalendarJS.Calendar(
        //     calendarTag,
        //     {
        //         initialView: 'dayGridMonth'
        //     }
        // )
        let host = this.host;
        let calendar = new Calendar(calendarTag, {
            plugins: [ interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin ],
            headerToolbar: {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            navLinks: true, // can click day/week names to navigate views
            editable: true,
            // dayMaxEvents: true, // allow "more" link when too many events
            events: data,
            eventDidMount: function(info) {
                info.el.title = info.event.extendedProps.description
            },
            eventClick: function(info) {
                info.jsEvent.preventDefault();
                host.launchUrl(info.event.url);
            }
          });
        calendar.render()
        calendarTag.style.height = options.viewport.height + "px";
        calendarTag.style.color = this.fontColor;
        calendarTag.style.fontSize = this.fontSize.toString() + "px";
    }

    private updateSettings(dataView: DataView): void {
        let metadata = dataView.metadata;
        let metadataObjects = metadata.objects;

        if (metadataObjects) {
            let fontColor = metadataObjects[Visual.CalendarFontColorPropertyIdentifiers.objectName];
            this.fontColor = (fontColor[Visual.CalendarFontColorPropertyIdentifiers.propertyName] as any).solid.color as string;
            let fontSize = metadataObjects[Visual.CalendarFontSizePropertyIdentifiers.objectName];
            this.fontSize = fontSize[Visual.CalendarFontSizePropertyIdentifiers.propertyName] as number;
        } 
        if(!this.fontColor) {
            this.fontColor = "#000000";
        }
        if(!this.fontSize) {
            this.fontSize = 12;
        }

        let categories = dataView.categorical.categories;
        let categoryObjects = categories[0].objects;           
        if (categoryObjects) {
            for (let i = 0; i < categoryObjects.length; i++) {
                if (categoryObjects[i]) {
                    let chartColorObject = categoryObjects[i][Visual.CategoryColorsPropertyIdentifiers.objectName];
                    let chartColorProperty = chartColorObject[Visual.CategoryColorsPropertyIdentifiers.propertyName];
                    let color = (chartColorProperty as any).solid.color;
                    if(i < this.itemStatus.length) {
                        this.itemStatus[i].color = color;
                    }
                }
            }
        }

    }

    // private static parseSettings(dataView: DataView): VisualSettings {
    //     return <VisualSettings>VisualSettings.parse(dataView);
    // }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        //return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        let instanceEnumeration: VisualObjectInstanceEnumeration = [];
        if (options.objectName === Visual.CalendarFontColorPropertyIdentifiers.objectName) {
            this.enumerateCalendarFontColor(instanceEnumeration)
        }
        if (options.objectName === Visual.CalendarFontSizePropertyIdentifiers.objectName) {
            this.enumerateCalendarFontSize(instanceEnumeration)
        }
        if (options.objectName === Visual.CategoryColorsPropertyIdentifiers.objectName) {
            this.enumerateCategoryProperties(instanceEnumeration);
        }
        return instanceEnumeration;
    }
    private enumerateCalendarFontColor(instanceEnumeration: VisualObjectInstance[]) {
        instanceEnumeration.push({
            displayName: "Text Color",
            objectName: Visual.CalendarFontColorPropertyIdentifiers.objectName,
            selector: null,
            properties: {
                fontColor: {
                    numeric: this.fontColor || "#000000"
                }
            },
        })
    }
    private enumerateCalendarFontSize(instanceEnumeration: VisualObjectInstance[]) {
        instanceEnumeration.push({
            displayName: "Text Color",
            objectName: Visual.CalendarFontSizePropertyIdentifiers.objectName,
            selector: null,
            properties: {
                fontSize: {
                    numeric: this.fontSize || 12
                }
            },
        })
    }
    private enumerateCategoryProperties(instanceEnumeration: VisualObjectInstance[]): void {
        let items = this.itemStatus;
        if (!items || items.length < 1) {
            return;
        }

        items.forEach((item) => {
            let selectionID: powerbi.visuals.ISelectionId = item.selectionID;
            let displayName: string = "" + item.category;

            instanceEnumeration.push({
                displayName,
                objectName: Visual.CategoryColorsPropertyIdentifiers.objectName,
                selector: (selectionID as powerbi.visuals.ISelectionId).getSelector(),
                //selector: null,
                properties: {
                    fill: {
                        solid: {
                            color: item.color
                        }
                    }
                }

            })

        })
    }
}