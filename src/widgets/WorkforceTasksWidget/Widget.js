define(['dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/dom-construct',
    'dojo/_base/html',
    'dojo/on',
    'dijit/form/Select',
    'esri/graphic',
    'esri/layers/FeatureLayer',
    "esri/geometry/Point",
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'jimu/utils',
    "dijit/form/CheckBox",
    "dijit/form/Button",
     'jimu/dijit/Message',
    'jimu/BaseWidget'],
function (declare,
    lang,
    domConstruct,
    html,
    on,
    Select,
    Graphic,
    FeatureLayer,
    Point,
    Query,
    QueryTask,
    jimuUtils,
    CheckBox,
    Button,
    Message,
    BaseWidget) {
    //To create a widget, you need to derive from BaseWidget.
    return declare([BaseWidget], {

        // Custom widget code goes here

        baseClass: 'workforce-tasks-widget',
        // this property is set by the framework when widget is loaded.
        // name: 'WorkforceTasksWidget',
        // add additional properties here
        cmbProject: undefined,
        currentProject: undefined,
        workId: undefined,
        assignmentCentre: undefined,
        currentTasks: [],
        //methods to communication with app container:
        postCreate: function () {
            this.inherited(arguments);
            console.log('WorkforceTasksWidget::postCreate');


            var options = [];
            this.config.projects.forEach(lang.hitch(this, function (project) {
                options.push({ label: project.name, value: project.name });
            }));

            this.cmbProject = new Select({
                name: 'cmbProjects',
                style: { "width": "200px" },
                options: options
            }).placeAt(this.divSelect);

            if (this.config.projects.length > 0) {
                this.currentProject = this.config.projects[0];
                this._createAssignments();
            }

            this.btnCreate = new Button({
                label: "Create Assignments",
                onClick: lang.hitch(this, this._createWorkforceTask)
            }, this.divButtons).startup();


            this.own(this.cmbProject.on('change', lang.hitch(this, function (evt) {
                console.log(evt);
                this.currentTasks = [],
                this.config.projects.forEach(lang.hitch(this, function (project) {
                    if (project.name === evt) {
                        this.currentProject = project;
                        this._createAssignments();
                    }
                }));
            })));





        },

        _createWorkforceTask: function () {
            if (this.workId === undefined) {
                new Message({ message: "No work id field is defined" });
                return;
            }
            if (this.assignmentCentre === undefined) {
                new Message({ message: "No assignment center is defined" });
                return;
            }
            if (this.currentTasks.length === 0) {
                new Message({ message: "No assignments selected" });
                return;
            }
            var points = this._getAssignmentPoints();

            var newFeatures = [];

            var fl = new FeatureLayer(this.currentProject.url);

            for (var i = 0; i < this.currentTasks.length; i++) {

                var description = "";
                for (var j = 0; j < this.currentProject.assignments.length; j++) {
                    var assignment = this.currentProject.assignments[j];
                    if (assignment.code === this.currentTasks[i]) {
                        description = assignment.description;
                    }
                }

                var attributes = {
                    "description": description,
                    "status": 0,
                    "notes": "",
                    "priority": 2,
                    "assignmentType": this.currentTasks[i],
                    "workOrderId": this.workId,


                };
                var g = new Graphic(points[i], null, attributes, null);
                newFeatures.push(g);
            }

            //new Graphic(geometry?, symbol?, attributes?, infoTemplate?)
            fl.applyEdits(newFeatures, null, null, lang.hitch(this, function (addResults) {
                if (addResults[0].success) {
                    new Message({ message: "Assigments created" });
                    this.map.centerAt(this.assignmentCentre);
                    this._reset();
                    return;
                }
                else {
                    new Message({ message: "Failed to create assigments" });
                }
            }));

        },

        _reset: function () {
            this.currentTasks = [];
            this.workId = undefined;
            this.assignmentCentre = undefined;
        },

        _getAssignmentPoints() {
            if (this.currentTasks.length === 1) {
                return [this.assignmentCentre];
            }

            var angle = 360 / (this.currentTasks.length);
            var currentAngle = angle;
            var points = [];

            for (var i = 0; i < this.currentTasks.length; i++) {
                distance = 200;

                var x = Math.round(Math.cos(currentAngle * Math.PI / 180) * distance + this.assignmentCentre.x);
                var y = Math.round(Math.sin(currentAngle * Math.PI / 180) * distance + this.assignmentCentre.y);

                var p = new Point(x, y, this.assignmentCentre.spatialReference);
                points.push(p);
                currentAngle += angle;
            }
            return points;
        },


        _createAssignments: function () {
            html.empty(this.divAssignments);

            this.currentProject.assignments.forEach(lang.hitch(this, function (assignment) {

                var checkBox = new CheckBox({
                    name: "checkBox" + assignment.code,
                    value: assignment.code,
                    checked: false
                });

                this.own(checkBox.on('change', lang.hitch(this, this._addRemoveAssignment, assignment.code)))

                domConstruct.place(checkBox.domNode, this.divAssignments, 'last');
                var checkLabel = domConstruct.create('label', { 'for': checkBox.name, innerHTML: assignment.description }, checkBox.domNode, "after");
                domConstruct.place("<br />", checkLabel, "after");


            }));
        },

        _addRemoveAssignment: function (code, value) {
            if (value === true) {
                this.currentTasks.push(code);
            }
            else {
                for (var i = this.currentTasks.length - 1; i >= 0; i--) {
                    if (this.currentTasks[i] === code) {
                        this.currentTasks.splice(i, 1);
                        return;
                    }
                }
            }
        },

        _onSetFeatures: function (evt) {
            evt.stopPropagation();
            var qt = new QueryTask(this.config.targetLayerUrl);
            var pointInPoly = new Query();
            pointInPoly.geometry = evt.mapPoint;
            pointInPoly.returnGeometry = true;
            pointInPoly.outFields = ["*"];
            qt.execute(pointInPoly, lang.hitch(this, function (data) {
                if (data.features.length > 0) {
                    this.workId = data.features[0].attributes[this.config.workIdField];
                    if (data.features[0].geometry.type === 'point') {
                        this.assignmentCentre = data.features[0].geometry;
                    }
                    else {
                        this.assignmentCentre = data.features[0].geometry.getCentroid();
                    }
                }
            }))
        },

        startup: function () {
            this.inherited(arguments);
            console.log('WorkforceTasksWidget::startup');

        },

        onOpen: function () {
            console.log('WorkforceTasksWidget::onOpen');
            this.clickHandler = on(this.map, 'click', lang.hitch(this, this._onSetFeatures));
        },

        onClose: function () {
            console.log('WorkforceTasksWidget::onClose');
            this.clickHandler.remove();
        },

        // onMinimize: function(){
        //   console.log('WorkforceTasksWidget::onMinimize');
        // },

        // onMaximize: function(){
        //   console.log('WorkforceTasksWidget::onMaximize');
        // },

        // onSignIn: function(credential){
        //   console.log('WorkforceTasksWidget::onSignIn', credential);
        // },

        // onSignOut: function(){
        //   console.log('WorkforceTasksWidget::onSignOut');
        // }

        // onPositionChange: function(){
        //   console.log('WorkforceTasksWidget::onPositionChange');
        // },

        // resize: function(){
        //   console.log('WorkforceTasksWidget::resize');
        // }

        //methods to communication between widgets:

    });

});
