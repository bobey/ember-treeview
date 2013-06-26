(function() {

    // Ember Tree
    Ember.Tree = Ember.Namespace.create();

    // Ember Tree Node
    Ember.Tree.Node = Ember.ObjectProxy.extend({
        label: null,
        isActive: false,
        isSelected: false,
        isOpened: false,
        parent: null,
        children: [],

        isVisible: function() {
            return this._hierarchyIsVisible(this);
        }.property('isRoot', 'parent', 'parent.isVisible', 'parent.isOpened'),

        isVisibleUnderRoot: function() {
            return this._hierarchyIsVisible(this, true);
        }.property('parent.isRoot', 'parent', 'parent.isVisible', 'parent.isOpened'),

        _hierarchyIsVisible: function(node, underRoot) {
            if (!underRoot && node.get('isRoot') || underRoot && node.get('parent.isRoot')) {
                return true;
            }

            return node.get('parent.isOpened') && this._hierarchyIsVisible(node.get('parent'), underRoot);
        },

        level: function() {
            return this._computeLevel(this.get('parent'), 0);
        }.property().volatile(),

        isRoot: function() {
            return this.get('parent') === null;
        }.property('parent'),

        isBranch: function() {
            return this.get('children').length > 0;
        }.property('children', 'children.@each'),

        isLeaf: function() {
            return !this.get('children').length;
        }.property('children', 'children.@each'),

        _computeLevel: function(node, level) {
            if (null !== node) {
                return this._computeLevel(node.get('parent'), level+1);
            }

            return level;
        }
    });

    // Mixins
    /**
     * Ember.StyleBindingsMixin
     * CREDITS for this one to Addepar EmberTable
     */
    Ember.StyleBindingsMixin = Ember.Mixin.create({
        concatenatedProperties: ['styleBindings'],
        attributeBindings: ['style'],
        unitType: 'px',
        createStyleString: function(styleName, property) {
            var value;
            value = this.get(property);
            if (value === void 0) {
                return;
            }
            if (Ember.typeOf(value) === 'number') {
                value = value + this.get('unitType');
            }
            return "" + styleName + ":" + value + ";";
        },
        applyStyleBindings: function() {
            var lookup, properties, styleBindings, styleComputed, styles,
                _this = this;
            styleBindings = this.styleBindings;
            if (!styleBindings) {
                return;
            }
            lookup = {};
            styleBindings.forEach(function(binding) {
                var property, style, _ref;
                _ref = binding.split(':'), property = _ref[0], style = _ref[1];
                return lookup[style || property] = property;
            });
            styles = Ember.keys(lookup);
            properties = styles.map(function(style) {
                return lookup[style];
            });
            styleComputed = Ember.computed(function() {
                var styleString, styleTokens;
                styleTokens = styles.map(function(style) {
                    return _this.createStyleString(style, lookup[style]);
                });
                styleString = styleTokens.join('');
                if (styleString.length !== 0) {
                    return styleString;
                }
            });
            styleComputed.property.apply(styleComputed, properties);
            return Ember.defineProperty(this, 'style', styleComputed);
        },
        init: function() {
            this.applyStyleBindings();
            return this._super();
        }
    });

    // Utils
    function _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent) {

        if (controller.isDropAllowed(overingNode, newParent)) {

            // Node doesn't belongs to its old parent anymore
            if (overingNode.get('parent')) {
                overingNode.get('parent.children').removeObject(overingNode);
            }

            if (!newParent.get('isOpened')) {
                newParent.set('isOpened', true);
                controller.nodeOpenStateChanged(newParent);
            }
            overingNode.set('parent', newParent);
            newParent.get('children').insertAt(newPosition, overingNode);

            controller.nodeMoved(overingNode, oldPosition, oldParent, newPosition, newParent);
        }
    };

    function _getNodeFromDOM($element) {

        var emberView = Ember.View.views[$element.attr('id')];
        if (!emberView) {
            return $element;
        }

        if (emberView.get('node') instanceof Ember.Tree.Node) {
            return emberView.get('node')
        }

        return emberView;
    };

    // Controllers
    Ember.Tree.TreeController = Ember.Controller.extend({

        // Configuration
        draggable: true,
        droppable: true,
        selectable: true,

        treeNodeContainerViewClass: 'Ember.Tree.TreeNodeContainer',
        treeNodeViewClass: 'Ember.Tree.TreeNode',
        treeNodeAfterViewClass: 'Ember.Tree.TreeNodeAfter',
        treeDraggingNodeClass: 'Ember.Tree.DraggingNode',
        displayRootElement: false,

        treeContent: [],

        selectedNodes: function() {
            return this.get('treeContent').filterProperty('isSelected', true);
        }.property('treeContent.@each.isSelected'),

        _isDescendantOf: function(descendant, parent) {
            if (!descendant || !parent || this.get('displayRootElement') && null === descendant.get('parent') || !this.get('displayRootElement') && descendant.get('parent.isRoot')) {
                return false;
            }

            return descendant.get('parent') === parent ? true : this._isDescendantOf(descendant.get('parent'), parent);
        },

        isDropAllowed: function(overingNode, targetNode) {
            if (!(overingNode instanceof Ember.Tree.Node) || !(targetNode instanceof Ember.Tree.Node)) {
                return false;
            }

            if (targetNode === overingNode) {
                return false;
            }

            return !this._isDescendantOf(targetNode, overingNode);
        },

        _lastNodeClicked: null,

        /**
         * @method nodeDropped
         *
         * @param {Ember.View}
         * @param {Number} position
         * @param {Ember.Tree.TreeNode} parent
         */
        elementDropped: Ember.K,

        /**
         * @method nodeMoved
         *
         * @param {Ember.Tree.TreeNode} node
         * @param {Number} oldPosition
         * @param {Ember.Tree.TreeNode} oldParent
         * @param {Number} newPosition
         * @param {Ember.Tree.TreeNode} newParent
         */
        nodeMoved: Ember.K,

        /**
         * @method nodeSelectionStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeSelectionStateChanged: Ember.K,

        /**
         * @method nodeOpenStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeOpenStateChanged: Ember.K,

        /**
         * @method nodeActiveStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeActiveStateChanged: Ember.K
    });

    // Views
    Ember.Tree.DraggingNode = Ember.View.extend({
        node: null,
        targetNode: null,
        controller: null,
        isDropAllowed: function() {
            var node = this.get('node'),
                targetNode = this.get('targetNode');

            return this.get('controller').isDropAllowed(node, targetNode)
        }.property('controller', 'targetNode', 'node'),

        classNameBindings: ['isDropAllowed:allowed:not-allowed'],
        classNames: ['dragging-node-tooltip'],

        template: Ember.Handlebars.compile('{{view.node.label}}')
    });

    Ember.Tree.TreeContainer = Ember.CollectionView.extend({

        didInsertElement: function() {
            this._buildContent();
        },
        controller: null,
        nodes: Ember.computed.alias('controller.treeContent'),
        itemViewClass: Ember.computed.alias('controller.treeNodeContainerViewClass'),
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        classNames: ['tree-container'],

        emptyView: function() {
            return Ember.get('Ember.Tree.TreeNodeEmptyView');
        }.property(),

        content: [],

        treeContentDidChanged: function() {
            Ember.run.once(this, this._buildContent);
        }.observes('nodes', 'nodes.@each'),

        _buildContent: function() {
            var tree = [],
                root = this.get('nodes').findProperty('isRoot', true);

            if (!root) {
                return;
            }

            if (this.get('displayRootElement')) {
                tree.pushObject(root);
            }

            this._flattenTree(tree, root);

            this.set('content', tree);
        },

        _flattenTree: function(tree, node) {
            node.get('children').forEach(function(childNode) {
                tree.pushObject(childNode);
                this._flattenTree(tree, childNode);
            }, this);
        }
    });

    Ember.Tree.TreeNodeContainer = Ember.View.extend(Ember.StyleBindingsMixin, {
        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeView}} {{view view.treeNodeAfterView}}'),
        classNames: ['tree-node-container'],
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        selectable: Ember.computed.alias('controller.selectable'),

        treeNodeView: function() {
            return Ember.get(this.get('controller.treeNodeViewClass'));
        }.property('controller.treeNodeViewClass'),

        treeNodeAfterView: function() {
            return Ember.get(this.get('controller.treeNodeAfterViewClass'));
        }.property('controller.treeNodeAfterViewClass'),

        styleBindings:  ['indentation:padding-left'],

        indentation: function() {
            return (this.get('node.level') - (this.get('displayRootElement') ? 0 : 1) ) * 20 + 'px';
        }.property('node.level'),

        nodes: Ember.computed.alias('parentView.content'),
        node: Ember.computed.alias('content'),
        selectedNodes: Ember.computed.alias('controller.selectedNodes'),
        _lastNodeClicked: Ember.computed.alias('controller._lastNodeClicked'),

        // Events
        mouseEnter: function() {
            this.get('node').set('isActive', true);
            this.get('controller').nodeActiveStateChanged(this.get('node'));
        },

        mouseLeave: function() {
            this.get('node').set('isActive', false);
            this.get('controller').nodeActiveStateChanged(this.get('node'));
        },

        doubleClick: function() {
            //TODO: prevent click if double click is detected
            var node = this.get('node');
            node.toggleProperty('isOpened');
            this.get('controller').nodeOpenStateChanged(node);
        },

        click: function(event) {

            if (!this.get('selectable')) {
                return;
            }

            var node = this.get('node'),
                nodes = this.get('nodes'),
                lastNodeClicked = this.get('_lastNodeClicked'),
                selectedNodes = this.get('selectedNodes');

            if (!event.ctrlKey && !event.shiftKey) {
                var currentNode = node;
                nodes.forEach(function(node) {
                    if (node !== currentNode) {
                        node.set('isSelected', false);
                    }
                });
            }

            if (event.shiftKey) {
                if (lastNodeClicked && lastNodeClicked.get('isSelected')) {
                    var lastNodeClickedIndex = nodes.indexOf(lastNodeClicked),
                        nodeClickedIndex = nodes.indexOf(node);

                    nodes.forEach(function(node, index) {
                        if (lastNodeClickedIndex < nodeClickedIndex && index >= lastNodeClickedIndex && index <= nodeClickedIndex || lastNodeClickedIndex > nodeClickedIndex && index <= lastNodeClickedIndex && index >= nodeClickedIndex) {
                            node.set('isSelected', true);
                        }
                    }, this);
                }
            } else {
                if (selectedNodes.length > 1 && !event.ctrlKey) {
                    node.set('isSelected', true);
                } else {
                    node.toggleProperty('isSelected');
                }
            }

            this.set('_lastNodeClicked', node);

            this.get('controller').nodeSelectionStateChanged(node);
        }
    });

    Ember.Tree.DroppableView = Ember.View.extend({
        classNameBindings: ['isNodeOver:drag-over', 'isDragForbidden:drag-forbidden'],

        didInsertElement: function() {
            if (!this.get('droppable') || !this.$()) {
                return;
            }

            this.$().droppable({
                tolerance: 'pointer',
                drop: Ember.$.proxy(this.onNodeDropped, this),
                over: Ember.$.proxy(this.onNodeOver, this),
                out: Ember.$.proxy(this.onNodeOut, this)
            });
        },

        _out: function(ui) {
            this.setProperties({
                isNodeOver: false,
                isDragForbidden: false
            });

            var overingNode = Ember.View.views[ui.draggable.attr('id')];
            if (overingNode.get('_treeDraggingNodeView')) {
                overingNode.get('_treeDraggingNodeView').set('targetNode', null);
            }
        },

        onNodeOut: function(event, ui) {
            this._out(ui);
        },

        onNodeDropped: function(event, ui) {
            this._out(ui);
        },

        targetNode: function() {
            return this.get('node');
        }.property('node'),

        isNodeOver: false,
        isDragForbidden: false,

        onNodeOver: function(event, ui) {
            this.set('isNodeOver', true);

            var targetNode = this.get('targetNode'),
                overingNodeView = Ember.View.views[ui.draggable.attr('id')],
                treeDraggingNodeView = overingNodeView.get('_treeDraggingNodeView'),
                controller = this.get('controller');

            if (treeDraggingNodeView) {
                treeDraggingNodeView.set('targetNode', targetNode);
            }

            if (!controller.isDropAllowed((overingNodeView.get('node') instanceof Ember.Tree.Node) ? overingNodeView.get('node') : overingNodeView, targetNode)) {
                this.set('isDragForbidden', true);
            }
        }
    });

    Ember.Tree.TreeNodeView = Ember.Tree.DroppableView.extend({
        node: Ember.computed.alias('parentView.node'),

        isVisible: function() {
            return this.get('displayRootElement') && this.get('node.isVisible') || !this.get('displayRootElement') && this.get('node.isVisibleUnderRoot');
        }.property('displayRootElement', 'node.parent.isRoot', 'node.isVisible', 'node.isVisibleUnderRoot'),

        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        draggable: Ember.computed.alias('controller.draggable'),
        droppable: Ember.computed.alias('controller.droppable')
    });

    Ember.Tree.TreeNode = Ember.Tree.TreeNodeView.extend({

        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeHeader}} <span class="node-content">{{view.nodeContent}}</span>'),
        classNames: ['tree-node'],
        classNameBindings: ['node.isActive', 'node.isSelected', 'node.isBranch', 'node.isOpened:is-opened:is-closed'],

        _treeDraggingNodeView: null,

        treeDraggingNodeView: function() {
            return Ember.get(this.get('controller.treeDraggingNodeClass'));
        }.property('controller.treeDraggingNodeClass'),

        nodeContent: function() {
            return this.get('node.label');
        }.property('node.label'),

        didInsertElement: function() {
            this._super();

            var view = this,
                treeDraggingNodeView = this.get('treeDraggingNodeView');

            if (!this.get('draggable')) {
                return;
            }

            this.$().draggable({
                appendTo: 'body',
                helper: function() {

                    var treeDraggingNodeViewInstance = treeDraggingNodeView.create();

                    treeDraggingNodeViewInstance.setProperties({
                        node: view.get('node'),
                        parentView: view,
                        controller: view.get('controller')
                    });

                    view.set('_treeDraggingNodeView', treeDraggingNodeViewInstance.appendTo('#dragging'));

                    return Ember.$('<span id="dragging"/>');
                },

                start: function() {
                    var node = view.get('node'),
                        selectedNodes = view.get('controller.selectedNodes');

                    // If current dragging node isn't in selected nodes, we deselect all of them
                    if (-1 === selectedNodes.indexOf(node)) {
                        selectedNodes.forEach(function(node) {
                            node.set('isSelected', false);
                            view.get('controller').nodeSelectionStateChanged(node);
                        }, this);
                    }
                },

                stop: function() {
                    view.get('_treeDraggingNodeView').destroy();
                }
            });
        },

        onNodeDropped: function(event, ui) {
            this._super(event, ui);

            var overingNode = _getNodeFromDOM(ui.draggable),
                controller = this.get('controller'),
                newPosition = this.get('node.children').length,
                newParent = this.get('node');

            // Node to move
            if (overingNode instanceof Ember.Tree.Node) {
                var oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                    oldParent = overingNode.get('parent');

                if (oldParent === newParent) {
                    return;
                }

                Ember.run.scheduleOnce('afterRender', this, function() {
                    _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
                    this.get('parentView.parentView')._buildContent();
                });
            }

            controller.elementDropped(overingNode, newPosition, newParent);
        },

        treeNodeHeader: Ember.View.extend({
            node: Ember.computed.alias('parentView.node'),
            classNames: ['tree-node-header'],
            click: function(event) {
                if (this.get('node.isBranch')) {
                    event.stopPropagation();
                    this.get('node').toggleProperty('isOpened');
                    this.get('controller').nodeOpenStateChanged(this.get('node'));
                }
            }
        })
    });

    /**
     * Target area displayed after each node
     */
    Ember.Tree.TreeNodeAfter = Ember.Tree.TreeNodeView.extend({
        classNames: ['drop-after-node'],

        targetNode: function() {
            return this.get('node.parent');
        }.property('node', 'node.parent'),

        onNodeDropped: function(event, ui) {
            this._super(event, ui);

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                targetNode = this.get('node'),
                newPosition = targetNode.get('parent.children').indexOf(targetNode),
                newParent = targetNode.get('parent');

            if (overingNode instanceof Ember.Tree.Node) {
                var oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                    oldParent = overingNode.get('parent');

                if (oldParent !== newParent || oldPosition > newPosition) {
                    newPosition++;
                }

                Ember.run.scheduleOnce('afterRender', this, function() {
                    _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
                    this.get('parentView.parentView')._buildContent();
                });
            }

            controller.elementDropped(overingNode, newPosition, newParent);
        }
    });

    Ember.Tree.TreeNodeEmptyView = Ember.Tree.DroppableView.extend({
        classNames: ['empty-drop-area'],
        droppable: Ember.computed.alias('controller.droppable'),

        targetNode: function() {
            return Ember.Tree.Node.create();
        }.property(),

        onNodeDropped: function(event, ui) {
            this._super(event, ui);

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable);

            controller.elementDropped(overingNode, 0, this.get('targetNode'));
        }
    });
})();
