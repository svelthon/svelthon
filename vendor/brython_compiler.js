"use strict";
(function($B){var _b_=$B.builtins
var GLOBAL_PARAM="name '%s' is parameter and global",NONLOCAL_PARAM="name '%s' is parameter and nonlocal",GLOBAL_AFTER_ASSIGN="name '%s' is assigned to before global declaration",NONLOCAL_AFTER_ASSIGN="name '%s' is assigned to before nonlocal declaration",GLOBAL_AFTER_USE="name '%s' is used prior to global declaration",NONLOCAL_AFTER_USE="name '%s' is used prior to nonlocal declaration",GLOBAL_ANNOT="annotated name '%s' can't be global",NONLOCAL_ANNOT="annotated name '%s' can't be nonlocal",IMPORT_STAR_WARNING="import * only allowed at module level",NAMED_EXPR_COMP_IN_CLASS=
"assignment expression within a comprehension cannot be used in a class body",NAMED_EXPR_COMP_CONFLICT=
"assignment expression cannot rebind comprehension iteration variable '%s'",NAMED_EXPR_COMP_INNER_LOOP_CONFLICT=
"comprehension inner loop cannot rebind assignment expression target '%s'",NAMED_EXPR_COMP_ITER_EXPR=
"assignment expression cannot be used in a comprehension iterable expression",ANNOTATION_NOT_ALLOWED=
"'%s' can not be used within an annotation",DUPLICATE_ARGUMENT="duplicate argument '%s' in function definition",TYPEVAR_BOUND_NOT_ALLOWED="%s cannot be used within a TypeVar bound",TYPEALIAS_NOT_ALLOWED="%s cannot be used within a type alias",TYPEPARAM_NOT_ALLOWED=
"%s cannot be used within the definition of a generic",DUPLICATE_TYPE_PARAM="duplicate type parameter '%s'"
var SF=$B.SYMBOL_FLAGS 
var NULL=undefined
var ModuleBlock=2,ClassBlock=1,FunctionBlock=0,AnnotationBlock=4,TypeVarBoundBlock=5,TypeAliasBlock=6,TypeParamBlock=7
var PyExc_SyntaxError=_b_.SyntaxError
function assert(test){if(! $B.$bool(test)){console.log('test fails',test)
throw Error('test fails')}}
function LOCATION(x){
return[x.lineno,x.col_offset,x.end_lineno,x.end_col_offset]}
function ST_LOCATION(x){
return[x.lineno,x.col_offset,x.end_lineno,x.end_col_offset]}
function _Py_Mangle(privateobj,ident){
var plen,ipriv
if(privateobj==NULL ||! ident.startsWith('__')){return ident}
plen=privateobj.length
if(ident.endsWith('__')||ident.search(/\./)!=-1){return ident }
ipriv=0
while(privateobj[ipriv]=='_'){ipriv++}
if(ipriv==plen){return ident }
var prefix=privateobj.substr(ipriv)
return '_'+prefix+ident}
var lambda=NULL
var NoComprehension=0,ListComprehension=1,DictComprehension=2,SetComprehension=3,GeneratorExpression=4
function GET_IDENTIFIER(VAR){return VAR}
function Symtable(){this.filename=NULL
this.stack=[]
this.blocks=new Map()
this.cur=NULL
this.private=NULL
this.deleted=new Set()}
function id(obj){if(obj[$B.ID]!==undefined){return obj[$B.ID]}
return obj[$B.ID]=$B.UUID()}
function ste_new(st,name,block,key,lineno,col_offset,end_lineno,end_col_offset){var ste
ste={table:st,id:id(key),
name:name,directives:NULL,type:block,nested:0,free:0,varargs:0,varkeywords:0,opt_lineno:0,opt_col_offset:0,lineno:lineno,col_offset:col_offset,end_lineno:end_lineno,end_col_offset:end_col_offset}
if(st.cur !=NULL &&
(st.cur.nested ||
st.cur.type==FunctionBlock)){ste.nested=1}
ste.child_free=0
ste.generator=0
ste.coroutine=0
ste.comprehension=NoComprehension
ste.returns_value=0
ste.needs_class_closure=0
ste.comp_inlined=0
ste.comp_iter_target=0
ste.comp_iter_expr=0
ste.symbols=$B.empty_dict()
ste.varnames=[]
ste.children=[]
st.blocks.set(ste.id,ste)
return ste}
$B._PySymtable_Build=function(mod,filename,future){var st=new Symtable(),seq
st.filename=filename
st.future=future ||{}
st.type=SF.TYPE_MODULE
if(!symtable_enter_block(st,'top',ModuleBlock,mod,0,0,0,0)){return NULL}
st.top=st.cur
switch(mod.constructor){case $B.ast.Module:
seq=mod.body
for(let item of seq){visitor.stmt(st,item)}
break
case $B.ast.Expression:
visitor.expr(st,mod.body)
break
case $B.ast.Interactive:
seq=mod.body
for(let item of seq){visitor.stmt(st,item)}
break}
symtable_analyze(st)
return st.top}
function _PyST_GetSymbol(ste,name){return $B.str_dict_get(ste.symbols,name,0)}
function _PyST_GetScope(ste,name){var symbol=_PyST_GetSymbol(ste,name)
return(symbol >> SF.SCOPE_OFFSET)& SF.SCOPE_MASK}
function _PyST_IsFunctionLike(ste){return ste.type==FunctionBlock
||ste.type==TypeVarBoundBlock
||ste.type==TypeAliasBlock
||ste.type==TypeParamBlock}
function PyErr_Format(exc_type,message,arg){if(arg){message=_b_.str.nb_remainder(message,arg)}
return $B.$call(exc_type,message)}
function PyErr_SetString(exc_type,message){return exc_type.$factory(message)}
function set_exc_info(exc,filename,lineno,offset,end_lineno,end_offset){exc.filename=filename
exc.lineno=lineno
exc.offset=offset+1
exc.end_lineno=end_lineno
exc.end_offset=end_offset+1
var src=$B.file_cache[filename]
if(src !==undefined){var lines=src.split('\n')
exc.text=lines[lineno-1]}else{
exc.text=''}
exc.args[1]=[filename,exc.lineno,exc.offset,exc.text,exc.end_lineno,exc.end_offset]}
function error_at_directive(exc,ste,name){assert(ste.directives)
for(var data of ste.directives){if(data[0]==name){set_exc_info(exc,ste.table.filename,data[1],data[2],data[3],data[4])
return 0}}
$B.RAISE(_b_.RuntimeError,"BUG: internal directive bookkeeping broken")}
function SET_SCOPE(DICT,NAME,I){DICT[NAME]=I}
function is_free_in_any_child(entry,key){for(var child_ste of entry.ste_children){var scope=_PyST_GetScope(child_ste,key)
if(scope==SF.FREE){return 1}}
return 0}
function inline_comprehension(ste,comp,scopes,comp_free,inlined_cells){for(var item of _b_.dict.$iter_items(comp.symbols)){
var k=item.key,comp_flags=item.value
if(comp_flags & SF.DEF_PARAM){continue}
var scope=(comp_flags >> SF.SCOPE_OFFSET)& SF.SCOPE_MASK
var only_flags=comp_flags &((1 << SF.SCOPE_OFFSET)-1)
if(scope==SF.CELL ||only_flags & SF.DEF_COMP_CELL){inlined_cells.add(k)}
var existing=$B.str_dict_contains(ste.symbols,k)
if(!existing){
var v_flags=only_flags
_b_.dict.$setitem(ste.symbols,k,v_flags)
SET_SCOPE(scopes,k,scope)}else{
if((existing & SF.DEF_BOUND)&&
!is_free_in_any_child(comp,k)&&
ste.type !==ClassBlock){_b_.set.tp_funcs.remove(comp_free,k)}}}
return 1}
function analyze_name(ste,scopes,name,flags,bound,local,free,global,type_params,class_entry){if(flags & SF.DEF_GLOBAL){if(flags & SF.DEF_NONLOCAL){let exc=PyErr_Format(_b_.SyntaxError,"name '%s' is nonlocal and global",name)
error_at_directive(exc,ste,name)
throw exc}
SET_SCOPE(scopes,name,SF.GLOBAL_EXPLICIT)
global.add(name)
if(bound){bound.delete(name)}
return 1}
if(flags & SF.DEF_NONLOCAL){if(!bound){let exc=PyErr_Format(_b_.SyntaxError,"nonlocal declaration not allowed at module level")
error_at_directive(exc,ste,name)
throw exc}
if(! bound.has(name)){let exc=PyErr_Format(_b_.SyntaxError,"no binding for nonlocal '%s' found",name)
error_at_directive(exc,ste,name)
throw exc}
if(type_params.has(name)){let exc=PyErr_Format(_b_.SyntaxError,"nonlocal binding not allowed for type parameter '%s'",name)
error_at_directive(exc,ste,name)
throw exc}
SET_SCOPE(scopes,name,SF.FREE)
ste.free=1
free.add(name)
return 1}
if(flags & SF.DEF_BOUND){SET_SCOPE(scopes,name,SF.LOCAL)
local.add(name)
global.delete(name)
if(flags & SF.DEF_TYPE_PARAM){type_params.add(name)}else{
type_params.delete(name)}
return 1}
if(class_entry !=NULL){var class_flags=_PyST_GetSymbol(class_entry,name)
if(class_flags & SF.DEF_GLOBAL){SET_SCOPE(scopes,name,SF.GLOBAL_EXPLICIT)
return 1}else if(class_flags & SF.DEF_BOUND &&
!(class_flags & SF.DEF_NONLOCAL)){SET_SCOPE(scopes,name,SF.GLOBAL_IMPLICIT)
return 1}}
if(bound && bound.has(name)){SET_SCOPE(scopes,name,SF.FREE)
ste.free=1
free.add(name)
return 1}
if(global && global.has(name)){SET_SCOPE(scopes,name,SF.GLOBAL_IMPLICIT)
return 1}
if(ste.nested){ste.free=1}
SET_SCOPE(scopes,name,SF.GLOBAL_IMPLICIT)
return 1}
function analyze_cells(scopes,free,inlined_cells){var v,v_cell
v_cell=SF.CELL
if(!v_cell){return 0}
for(let name in scopes){v=scopes[name]
var scope=v
if(scope !=SF.LOCAL){continue}
if(! free.has(name)&& ! inlined_cells.has(name)){continue}
scopes[name]=v_cell
free.delete(name)}
return 1}
function drop_class_free(ste,free){var res=free.delete('__class__')
if(res){ste.needs_class_closure=1}
res=free.delete('__classdict__')
if(res){ste.needs_class_classdict=1}
return 1}
function update_symbols(symbols,scopes,bound,free,inlined_cells,classflag){var v,v_scope,v_new,v_free
for(let entry of _b_.dict.$iter_items(symbols)){let name=entry.key
var test=false 
let flags=entry.value
if(test){console.log('in update symbols, name',name,'flags',flags,flags & SF.DEF_COMP_CELL)}
if(inlined_cells.has(name)){flags |=SF.DEF_COMP_CELL}
v_scope=scopes[name]
var scope=v_scope
if(test){console.log('name',name,'scopes[name]',scopes[name],' flags |=',scope << SF.SCOPE_OFFSET)}
flags |=(scope << SF.SCOPE_OFFSET)
v_new=flags
if(!v_new){return 0}
if(test){console.log('set symbol',name,'v_new',v_new,'def comp cell',SF.DEF_COMP_CELL,v_new & SF.DEF_COMP_CELL)}
$B.str_dict_set(symbols,name,v_new)}
v_free=SF.FREE << SF.SCOPE_OFFSET
for(let name of free){v=$B.str_dict_get(symbols,name)
if(v !==$B.NULL){
if(classflag &&
v &(SF.DEF_BOUND |SF.DEF_GLOBAL)){let flags=v |SF.DEF_FREE_CLASS
v_new=flags
if(! v_new){return 0}
$B.str_dict_set(symbols,name,v_new)}
continue}
if(bound && !bound.has(name)){continue;}
$B.str_dict_set(symbols,name,v_free)}
return 1}
function analyze_block(ste,bound,free,global,typeparams,class_entry){var success=0
let local=new Set()
let scopes={}
let newglobal=new Set()
let newfree=new Set()
let newbound=new Set()
let inlined_cells=new Set()
if(ste.type===ClassBlock){
Set_Union(newglobal,global)
if(bound){Set_Union(newbound,bound)}}
for(let entry of _b_.dict.$iter_items(ste.symbols)){var name=entry.key
var flags=entry.value
if(!analyze_name(ste,scopes,name,flags,bound,local,free,global,typeparams,class_entry)){return 0}}
if(ste.type !=ClassBlock){
if(_PyST_IsFunctionLike(ste)){Set_Union(newbound,local)}
if(bound){Set_Union(newbound,bound)}
Set_Union(newglobal,global)}else{
newbound.add('__class__')
newbound.add('__classdict__')}
for(var c of ste.children){var child_free=new Set()
let entry=c
var new_class_entry=NULL
if(entry.can_see_class_scope){if(ste.type==ClassBlock){new_class_entry=ste}else if(class_entry){new_class_entry=class_entry}}
var inline_comp=entry.comprehension && ! entry.generator
if(! analyze_child_block(entry,newbound,newfree,newglobal,typeparams,new_class_entry,child_free)){return 0}
if(inline_comp){if(! inline_comprehension(ste,entry,scopes,child_free,inlined_cells)){}
entry.comp_inlined=1}
Set_Union(newfree,child_free)
if(entry.free ||entry.child_free){ste.child_free=1}}
for(let i=ste.children.length-1;i >=0;i--){let entry=ste.children[i]
if(entry.comp_inlined){ste.children.splice(i,0,...entry.children)}}
if(_PyST_IsFunctionLike(ste)&& !analyze_cells(scopes,newfree,inlined_cells)){return 0}else if(ste.type===ClassBlock && !drop_class_free(ste,newfree)){return 0}
if(!update_symbols(ste.symbols,scopes,bound,newfree,inlined_cells,ste.type===ClassBlock ||ste.can_see_class_scope)){return 0}
Set_Union(free,newfree)
success=1
return success}
function PySet_New(arg){if(arg===NULL){return new Set()}
return new Set(arg)}
function Set_Union(setA,setB){for(let elem of setB){setA.add(elem)}}
function analyze_child_block(entry,bound,free,global,typeparams,class_entry,child_free){
var temp_bound=PySet_New(bound),temp_free=PySet_New(free),temp_global=PySet_New(global),temp_typeparams=PySet_New(typeparams)
if(!analyze_block(entry,temp_bound,temp_free,temp_global,temp_typeparams,class_entry)){return 0}
Set_Union(child_free,temp_free)
return 1}
function symtable_analyze(st){var free=new Set(),global=new Set(),typeparams=new Set()
return analyze_block(st.top,NULL,free,global,typeparams,NULL)}
function symtable_exit_block(st){var size=st.stack.length
st.cur=NULL
if(size){st.stack.pop()
if(--size){st.cur=st.stack[size-1]}}
return 1}
function symtable_enter_block(st,name,block,ast,lineno,col_offset,end_lineno,end_col_offset){var prev
if(ast===undefined){console.log('call ste new, key undef',st,name)}
var ste=ste_new(st,name,block,ast,lineno,col_offset,end_lineno,end_col_offset)
st.stack.push(ste)
prev=st.cur
if(prev){ste.comp_iter_expr=prev.comp_iter_expr}
st.cur=ste
if(block===AnnotationBlock){return 1}
if(block===ModuleBlock){st.global=st.cur.symbols}
if(prev){prev.children.push(ste)}
return 1}
function symtable_lookup(st,name){var mangled=_Py_Mangle(st.private,name)
if(!mangled){return 0}
var ret=_PyST_GetSymbol(st.cur,mangled)
return ret}
function symtable_add_def_helper(st,name,flag,ste,_location){var o,dict,val,mangled=_Py_Mangle(st.private,name)
if(!mangled){return 0}
dict=ste.symbols
var o=$B.str_dict_get(dict,mangled)
if(o !==$B.NULL){val=o
if((flag & SF.DEF_PARAM)&&(val & SF.DEF_PARAM)){
let exc=PyErr_Format(_b_.SyntaxError,DUPLICATE_ARGUMENT,name)
set_exc_info(exc,st.filename,..._location)
throw exc}
if((flag & SF.DEF_TYPE_PARAM)&&(val & SF.DEF_TYPE_PARAM)){let exc=PyErr_Format(_b_.SyntaxError,DUPLICATE_TYPE_PARAM,name)
set_exc_info(exc,st.filename,...location)
throw exc}
val |=flag}else{
val=flag}
if(ste.comp_iter_target){
if(val &(SF.DEF_GLOBAL |SF.DEF_NONLOCAL)){let exc=PyErr_Format(_b_.SyntaxError,NAMED_EXPR_COMP_INNER_LOOP_CONFLICT,name)
set_exc_info(exc,st.filename,..._location)
throw exc}
val |=SF.DEF_COMP_ITER}
o=val
if(o==NULL){return 0}
_b_.dict.$setitem(dict,mangled,o)
if(flag & SF.DEF_PARAM){ste.varnames.push(mangled)}else if(flag & SF.DEF_GLOBAL){
val=flag
var mangled_global=$B.str_dict_get(st.global,'mangled',$B.NULL)
if(mangled_global !==$B.NULL){val |=mangled_global}
o=val
if(o==NULL){return 0}
_b_.dict.$setitem(st.global,'mangled',o)}
return 1}
function symtable_add_def(st,name,flag,_location){return symtable_add_def_helper(st,name,flag,st.cur,_location)}
function symtable_enter_type_param_block(st,name,ast,has_defaults,has_kwdefaults,kind,_location){var prev=st.cur,current_type=st.cur.type
if(!symtable_enter_block(st,name,TypeParamBlock,ast,..._location)){return 0}
prev.$type_param=st.cur
if(current_type===ClassBlock){st.cur.can_see_class_scope=1
if(!symtable_add_def(st,"__classdict__",SF.USE,_location)){return 0}}
if(kind==$B.ast.ClassDef){
if(!symtable_add_def(st,"type_params",SF.DEF_LOCAL,_location)){return 0}
if(!symtable_add_def(st,"type_params",SF.USE,_location)){return 0}
st.st_private=name
var generic_base=".generic_base"
if(!symtable_add_def(st,generic_base,SF.DEF_LOCAL,_location)){return 0}
if(!symtable_add_def(st,generic_base,SF.USE,_location)){return 0}}
if(has_defaults){var defaults=".defaults"
if(!symtable_add_def(st,defaults,SF.DEF_PARAM,_location)){return 0}}
if(has_kwdefaults){var kwdefaults=".kwdefaults"
if(!symtable_add_def(st,kwdefaults,SF.DEF_PARAM,_location)){return 0}}
return 1}
function VISIT_QUIT(ST,X){return X}
function VISIT(ST,TYPE,V){var f=visitor[TYPE]
if(!f(ST,V)){VISIT_QUIT(ST,0)}}
function VISIT_SEQ(ST,TYPE,SEQ){for(var elt of SEQ){if(! visitor[TYPE](ST,elt)){VISIT_QUIT(ST,0)}}}
function VISIT_SEQ_TAIL(ST,TYPE,SEQ,START){for(var i=START,len=SEQ.length;i < len;i++){var elt=SEQ[i]
if(! visitor[TYPE](ST,elt)){VISIT_QUIT(ST,0)}}}
function VISIT_SEQ_WITH_NULL(ST,TYPE,SEQ){for(var elt of SEQ){if(! elt){continue }
if(! visitor[TYPE](ST,elt)){VISIT_QUIT((ST),0)}}}
function symtable_record_directive(st,name,lineno,col_offset,end_lineno,end_col_offset){var data,mangled
if(!st.cur.directives){st.cur.directives=[]}
mangled=_Py_Mangle(st.private,name)
if(!mangled){return 0}
data=$B.fast_tuple([mangled,lineno,col_offset,end_lineno,end_col_offset])
st.cur.directives.push(data)
return true}
function has_kwonlydefaults(kwonlyargs,kw_defaults){for(var i=0,len=kwonlyargs.length;i < len;i++){if(kw_defaults[i]){return 1}}
return 0}
var visitor={}
visitor.stmt=function(st,s){switch(s.constructor){case $B.ast.FunctionDef:
if(!symtable_add_def(st,s.name,SF.DEF_LOCAL,LOCATION(s)))
VISIT_QUIT(st,0)
if(s.args.defaults)
VISIT_SEQ(st,expr,s.args.defaults)
if(s.args.kw_defaults)
VISIT_SEQ_WITH_NULL(st,expr,s.args.kw_defaults)
if(s.type_params.length > 0){if(!symtable_enter_type_param_block(
st,s.name,s.type_params,s.args.defaults !=NULL,has_kwonlydefaults(s.args.kwonlyargs,s.args.kw_defaults),s.constructor,LOCATION(s))){VISIT_QUIT(st,0)}
VISIT_SEQ(st,type_param,s.type_params)}
if(!visitor.annotations(st,s,s.args,s.returns))
VISIT_QUIT(st,0)
if(s.decorator_list){VISIT_SEQ(st,expr,s.decorator_list)}
if(!symtable_enter_block(st,s.name,FunctionBlock,s,...LOCATION(s))){VISIT_QUIT(st,0)}
VISIT(st,'arguments',s.args)
VISIT_SEQ(st,stmt,s.body)
if(!symtable_exit_block(st)){VISIT_QUIT(st,0)}
if(s.type_params.length > 0){if(!symtable_exit_block(st)){VISIT_QUIT(st,0)}}
break
case $B.ast.ClassDef:
var tmp
if(!symtable_add_def(st,s.name,SF.DEF_LOCAL,LOCATION(s))){VISIT_QUIT(st,0)}
VISIT_SEQ(st,expr,s.bases)
VISIT_SEQ(st,keyword,s.keywords)
if(s.decorator_list){VISIT_SEQ(st,expr,s.decorator_list)}
if(s.type_params.length > 0){if(!symtable_enter_type_param_block(st,s.name,s.type_params,false,false,s.constructor,LOCATION(s))){VISIT_QUIT(st,0)}
VISIT_SEQ(st,type_param,s.type_params)}
VISIT_SEQ(st,expr,s.bases)
VISIT_SEQ(st,keyword,s.keywords)
if(!symtable_enter_block(st,s.name,ClassBlock,s,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset)){VISIT_QUIT(st,0)}
tmp=st.private
st.private=s.name
if(s.type_params.length > 0){if(!symtable_add_def(st,'__type_params__',SF.DEF_LOCAL,LOCATION(s))){VISIT_QUIT(st,0)}
if(!symtable_add_def(st,'type_params',SF.USE,LOCATION(s))){VISIT_QUIT(st,0)}}
VISIT_SEQ(st,stmt,s.body)
st.private=tmp
if(! symtable_exit_block(st))
VISIT_QUIT(st,0)
if(s.type_params.length > 0){if(!symtable_exit_block(st))
VISIT_QUIT(st,0)}
break
case $B.ast.TypeAlias:
VISIT(st,expr,s.name)
var name=s.name.id,is_in_class=st.cur.type===ClassBlock,is_generic=s.type_params.length > 0
if(is_generic){if(!symtable_enter_type_param_block(
st,name,s.type_params,false,false,s.kind,LOCATION(s))){VISIT_QUIT(st,0)}
VISIT_SEQ(st,type_param,s.type_params)}
if(!symtable_enter_block(st,name,TypeAliasBlock,s,LOCATION(s))){VISIT_QUIT(st,0)}
st.cur.can_see_class_scope=is_in_class
if(is_in_class && !symtable_add_def(st,'__classdict__',SF.USE,LOCATION(s.value))){VISIT_QUIT(st,0)}
VISIT(st,expr,s.value)
if(!symtable_exit_block(st)){VISIT_QUIT(st,0)}
if(is_generic){if(!symtable_exit_block(st))
VISIT_QUIT(st,0)}
break
case $B.ast.Return:
if(s.value){VISIT(st,expr,s.value)
st.cur.returns_value=1}
break
case $B.ast.Delete:
VISIT_SEQ(st,expr,s.targets)
break
case $B.ast.Assign:
VISIT_SEQ(st,expr,s.targets)
VISIT(st,expr,s.value)
break
case $B.ast.AnnAssign:
if(s.target instanceof $B.ast.Name){var e_name=s.target
var cur=symtable_lookup(st,e_name.id)
if(cur < 0){VISIT_QUIT(st,0)}
if((cur &(SF.DEF_GLOBAL |SF.DEF_NONLOCAL))
&&(st.cur.symbols !=st.global)
&& s.simple){var exc=PyErr_Format(_b_.SyntaxError,cur & SF.DEF_GLOBAL ? GLOBAL_ANNOT :NONLOCAL_ANNOT,e_name.id)
exc.args[1]=[st.filename,s.lineno,s.col_offset+1,s.end_lineno,s.end_col_offset+1]
throw exc}
if(s.simple &&
! symtable_add_def(st,e_name.id,SF.DEF_ANNOT |SF.DEF_LOCAL,LOCATION(e_name))){VISIT_QUIT(st,0)}else{
if(s.value
&& !symtable_add_def(st,e_name.id,SF.DEF_LOCAL,LOCATION(e_name))){VISIT_QUIT(st,0)}}}else{
VISIT(st,expr,s.target)}
if(!visitor.annotation(st,s.annotation)){VISIT_QUIT(st,0)}
if(s.value){VISIT(st,expr,s.value)}
break
case $B.ast.AugAssign:
VISIT(st,expr,s.target)
VISIT(st,expr,s.value)
break
case $B.ast.For:
VISIT(st,expr,s.target)
VISIT(st,expr,s.iter)
VISIT_SEQ(st,stmt,s.body)
if(s.orelse){VISIT_SEQ(st,stmt,s.orelse)}
break
case $B.ast.While:
VISIT(st,expr,s.test)
VISIT_SEQ(st,stmt,s.body)
if(s.orelse){VISIT_SEQ(st,stmt,s.orelse)}
break
case $B.ast.If:
VISIT(st,expr,s.test)
VISIT_SEQ(st,stmt,s.body)
if(s.orelse){VISIT_SEQ(st,stmt,s.orelse)}
break
case $B.ast.Match:
VISIT(st,expr,s.subject)
VISIT_SEQ(st,match_case,s.cases)
break
case $B.ast.Raise:
if(s.exc){VISIT(st,expr,s.exc)
if(s.cause){VISIT(st,expr,s.cause)}}
break
case $B.ast.Try:
VISIT_SEQ(st,stmt,s.body)
VISIT_SEQ(st,excepthandler,s.handlers)
VISIT_SEQ(st,stmt,s.orelse)
VISIT_SEQ(st,stmt,s.finalbody)
break
case $B.ast.TryStar:
VISIT_SEQ(st,stmt,s.body)
VISIT_SEQ(st,stmt,s.orelse)
VISIT_SEQ(st,excepthandler,s.handlers)
VISIT_SEQ(st,stmt,s.finalbody)
break
case $B.ast.Assert:
VISIT(st,expr,s.test)
if(s.msg){VISIT(st,expr,s.msg)}
break
case $B.ast.Import:
VISIT_SEQ(st,alias,s.names)
break
case $B.ast.ImportFrom:
VISIT_SEQ(st,alias,s.names)
break
case $B.ast.Global:
var seq=s.names
for(var name of seq){var cur=symtable_lookup(st,name)
if(cur < 0){VISIT_QUIT(st,0)}
if(cur &(SF.DEF_PARAM |SF.DEF_LOCAL |SF.USE |SF.DEF_ANNOT)){var msg
if(cur & SF.DEF_PARAM){msg=GLOBAL_PARAM}else if(cur & SF.USE){msg=GLOBAL_AFTER_USE}else if(cur & SF.DEF_ANNOT){msg=GLOBAL_ANNOT}else{
msg=GLOBAL_AFTER_ASSIGN}
var exc=PyErr_Format(_b_.SyntaxError,msg,name)
set_exc_info(exc,st.filename,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset)
throw exc}
if(! symtable_add_def(st,name,SF.DEF_GLOBAL,LOCATION(s)))
VISIT_QUIT(st,0)
if(! symtable_record_directive(st,name,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset))
VISIT_QUIT(st,0)}
break
case $B.ast.Nonlocal:
var seq=s.names
for(var name of seq){var cur=symtable_lookup(st,name)
if(cur < 0){VISIT_QUIT(st,0)}
if(cur &(SF.DEF_PARAM |SF.DEF_LOCAL |SF.USE |SF.DEF_ANNOT)){var msg
if(cur & SF.DEF_PARAM){msg=NONLOCAL_PARAM}else if(cur & SF.USE){msg=NONLOCAL_AFTER_USE}else if(cur & SF.DEF_ANNOT){msg=NONLOCAL_ANNOT}else{
msg=NONLOCAL_AFTER_ASSIGN}
var exc=PyErr_Format(_b_.SyntaxError,msg,name)
set_exc_info(exc,st.filename,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset)
throw exc}
if(!symtable_add_def(st,name,SF.DEF_NONLOCAL,LOCATION(s)))
VISIT_QUIT(st,0)
if(!symtable_record_directive(st,name,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset))
VISIT_QUIT(st,0)}
break
case $B.ast.Expr:
VISIT(st,expr,s.value)
break
case $B.ast.Pass:
case $B.ast.Break:
case $B.ast.Continue:
break
case $B.ast.With:
VISIT_SEQ(st,'withitem',s.items)
VISIT_SEQ(st,stmt,s.body)
break
case $B.ast.AsyncFunctionDef:
if(!symtable_add_def(st,s.name,SF.DEF_LOCAL,LOCATION(s)))
VISIT_QUIT(st,0)
if(s.args.defaults)
VISIT_SEQ(st,expr,s.args.defaults)
if(s.args.kw_defaults)
VISIT_SEQ_WITH_NULL(st,expr,s.args.kw_defaults)
if(!visitor.annotations(st,s,s.args,s.returns))
VISIT_QUIT(st,0)
if(s.decorator_list)
VISIT_SEQ(st,expr,s.decorator_list)
if(s.type_params.length > 0){if(!symtable_enter_type_param_block(
st,s.name,s.type_params,s.args.defaults !=NULL,has_kwonlydefaults(s.args.kwonlyargs,s.args.kw_defaults),s.constructor,LOCATION(s))){VISIT_QUIT(st,0)}
VISIT_SEQ(st,type_param,s.type_params)}
if(!visitor.annotations(st,s,s.args,s.returns)){VISIT_QUIT(st,0)}
if(!symtable_enter_block(st,s.name,FunctionBlock,s,s.lineno,s.col_offset,s.end_lineno,s.end_col_offset)){VISIT_QUIT(st,0)}
st.cur.coroutine=1
VISIT(st,'arguments',s.args)
VISIT_SEQ(st,stmt,s.body)
if(! symtable_exit_block(st)){VISIT_QUIT(st,0)}
if(s.type_params.length > 0){if(!symtable_exit_block(st))
VISIT_QUIT(st,0)}
break
case $B.ast.AsyncWith:
VISIT_SEQ(st,withitem,s.items)
VISIT_SEQ(st,stmt,s.body)
break
case $B.ast.AsyncFor:
VISIT(st,expr,s.target)
VISIT(st,expr,s.iter)
VISIT_SEQ(st,stmt,s.body)
if(s.orelse){VISIT_SEQ(st,stmt,s.orelse)}
break
default:
console.log('unhandled',s)
break}
VISIT_QUIT(st,1)}
function symtable_extend_namedexpr_scope(st,e){assert(st.stack)
assert(e instanceof $B.ast.Name)
var target_name=e.id
var i,size,ste
size=st.stack.length
assert(size)
for(i=size-1;i >=0;i--){ste=st.stack[i]
if(ste.comprehension){let target_in_scope=_PyST_GetSymbol(ste,target_name)
if(target_in_scope & SF.DEF_COMP_ITER){let exc=PyErr_Format(_b_.SyntaxError,NAMED_EXPR_COMP_CONFLICT,target_name)
set_exc_info(exc,st.filename,e.lineno,e.col_offset,e.ed_lineno,e.end_col_offset)
throw exc}
continue}
if(_PyST_IsFunctionLike(ste)){let target_in_scope=_PyST_GetSymbol(ste,target_name)
if(target_in_scope & SF.DEF_GLOBAL){if(!symtable_add_def(st,target_name,SF.DEF_GLOBAL,LOCATION(e))){VISIT_QUIT(st,0)}}else{
if(!symtable_add_def(st,target_name,SF.DEF_NONLOCAL,LOCATION(e))){VISIT_QUIT(st,0)}}
if(!symtable_record_directive(st,target_name,LOCATION(e))){VISIT_QUIT(st,0)}
return symtable_add_def_helper(st,target_name,SF.DEF_LOCAL,ste,LOCATION(e))}
if(ste.type==ModuleBlock){if(!symtable_add_def(st,target_name,SF.DEF_GLOBAL,LOCATION(e))){VISIT_QUIT(st,0)}
if(!symtable_record_directive(st,target_name,LOCATION(e))){VISIT_QUIT(st,0)}
return symtable_add_def_helper(st,target_name,SF.DEF_GLOBAL,ste,LOCATION(e))}
if(ste.type==ClassBlock){let exc=PyErr_Format(_b_.SyntaxError,NAMED_EXPR_COMP_IN_CLASS)
set_exc_info(exc,st.filename,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)
throw exc}}
return 0}
function symtable_handle_namedexpr(st,e){if(st.cur.comp_iter_expr > 0){
var exc=PyErr_Format(PyExc_SyntaxError,NAMED_EXPR_COMP_ITER_EXPR)
set_exc_info(exc,st.filename,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)
throw exc}
if(st.cur.comprehension){
if(!symtable_extend_namedexpr_scope(st,e.target))
return 0}
VISIT(st,expr,e.value)
VISIT(st,expr,e.target)
return 1}
const alias='alias',comprehension='comprehension',excepthandler='excepthandler',expr='expr',keyword='keyword',match_case='match_case',pattern='pattern',stmt='stmt',type_param='type_param',withitem='withitem'
visitor.expr=function(st,e){switch(e.constructor){case $B.ast.NamedExpr:
if(!symtable_raise_if_annotation_block(st,"named expression",e)){VISIT_QUIT(st,0)}
if(!symtable_handle_namedexpr(st,e)){VISIT_QUIT(st,0)}
break
case $B.ast.BoolOp:
VISIT_SEQ(st,expr,e.values)
break
case $B.ast.BinOp:
VISIT(st,expr,e.left)
VISIT(st,expr,e.right)
break
case $B.ast.UnaryOp:
VISIT(st,expr,e.operand)
break
case $B.ast.Lambda:{if(!GET_IDENTIFIER('lambda')){VISIT_QUIT(st,0)}
if(e.args.defaults){VISIT_SEQ(st,expr,e.args.defaults)}
if(e.args.kw_defaults){VISIT_SEQ_WITH_NULL(st,expr,e.args.kw_defaults)}
if(!symtable_enter_block(st,lambda,FunctionBlock,e,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)){VISIT_QUIT(st,0)}
VISIT(st,'arguments',e.args)
VISIT(st,expr,e.body)
if(!symtable_exit_block(st)){VISIT_QUIT(st,0)}
break}
case $B.ast.IfExp:
VISIT(st,expr,e.test)
VISIT(st,expr,e.body)
VISIT(st,expr,e.orelse)
break
case $B.ast.Dict:
VISIT_SEQ_WITH_NULL(st,expr,e.keys)
VISIT_SEQ(st,expr,e.values)
break
case $B.ast.Set:
VISIT_SEQ(st,expr,e.elts)
break
case $B.ast.GeneratorExp:
if(!visitor.genexp(st,e)){VISIT_QUIT(st,0)}
break
case $B.ast.ListComp:
if(!visitor.listcomp(st,e)){VISIT_QUIT(st,0)}
break
case $B.ast.SetComp:
if(!visitor.setcomp(st,e)){VISIT_QUIT(st,0)}
break
case $B.ast.DictComp:
if(!visitor.dictcomp(st,e)){VISIT_QUIT(st,0)}
break
case $B.ast.Yield:
if(!symtable_raise_if_annotation_block(st,"yield expression",e)){VISIT_QUIT(st,0)}
if(e.value){VISIT(st,expr,e.value)}
st.cur.generator=1
if(st.cur.comprehension){return symtable_raise_if_comprehension_block(st,e)}
break
case $B.ast.YieldFrom:
if(!symtable_raise_if_annotation_block(st,"yield expression",e)){VISIT_QUIT(st,0)}
VISIT(st,expr,e.value)
st.cur.generator=1
if(st.cur.comprehension){return symtable_raise_if_comprehension_block(st,e)}
break
case $B.ast.Await:
if(!symtable_raise_if_annotation_block(st,"await expression",e)){VISIT_QUIT(st,0)}
VISIT(st,expr,e.value)
st.cur.coroutine=1
break
case $B.ast.Compare:
VISIT(st,expr,e.left)
VISIT_SEQ(st,expr,e.comparators)
break
case $B.ast.Call:
VISIT(st,expr,e.func)
VISIT_SEQ(st,expr,e.args)
VISIT_SEQ_WITH_NULL(st,keyword,e.keywords)
break
case $B.ast.FormattedValue:
VISIT(st,expr,e.value)
if(e.format_spec){VISIT(st,expr,e.format_spec)}
break
case $B.ast.Interpolation:
VISIT(st,expr,e.value)
if(e.format_spec){VISIT(st,expr,e.format_spec)}
break
case $B.ast.JoinedStr:
VISIT_SEQ(st,expr,e.values)
break
case $B.ast.TemplateStr:
VISIT_SEQ(st,expr,e.values)
break
case $B.ast.Constant:
break
case $B.ast.Attribute:
VISIT(st,expr,e.value)
break
case $B.ast.Subscript:
VISIT(st,expr,e.value)
VISIT(st,expr,e.slice)
break
case $B.ast.Starred:
VISIT(st,expr,e.value)
break
case $B.ast.Slice:
if(e.lower){VISIT(st,expr,e.lower)}
if(e.upper){VISIT(st,expr,e.upper)}
if(e.step){VISIT(st,expr,e.step)}
break
case $B.ast.Name:
var flag=e.ctx instanceof $B.ast.Load ? SF.USE :SF.DEF_LOCAL
if(! symtable_add_def(st,e.id,flag,LOCATION(e))){VISIT_QUIT(st,0)}
if(e.ctx instanceof $B.ast.Del){st.deleted.add(e.id)}
if(e.ctx instanceof $B.ast.Load &&
_PyST_IsFunctionLike(st.cur)&&
e.id=="super"){if(!GET_IDENTIFIER('__class__')||
!symtable_add_def(st,'__class__',SF.USE,LOCATION(e)))
VISIT_QUIT(st,0)}
break
case $B.ast.List:
VISIT_SEQ(st,expr,e.elts)
break
case $B.ast.Tuple:
VISIT_SEQ(st,expr,e.elts)
break}
VISIT_QUIT(st,1)}
visitor.type_param_bound_or_default=function(st,e,name,key){if(e){var is_in_class=st.cur.can_see_class_scope
if(! symtable_enter_block(st,name,TypeVarBoundBlock,key,LOCATION(e))){return 0}
st.cur.can_see_class_scope=is_in_class
if(is_in_class && !symtable_add_def(st,'__classdict__',SF.USE,LOCATION(e))){VISIT_QUIT(st,0)}
VISIT(st,expr,e)
if(!symtable_exit_block(st)){return 0}}
return 1}
visitor.type_param=function(st,tp){switch(tp.constructor){case $B.ast.TypeVar:
if(! symtable_add_def(st,tp.name,SF.DEF_TYPE_PARAM |SF.DEF_LOCAL,LOCATION(tp))){VISIT_QUIT(st,0)}
if(! visitor.type_param_bound_or_default(st,tp.bound,tp.name,tp)){VISIT_QUIT(st,0)}
var _id={}
_id[$B.ID]=$B.UUID()
if(! visitor.type_param_bound_or_default(st,tp.default_value,tp.name,_id)){VISIT_QUIT(st,0)}
break
case $B.ast.TypeVarTuple:
if(! symtable_add_def(st,tp.name,SF.DEF_TYPE_PARAM |SF.DEF_LOCAL,LOCATION(tp))){VISIT_QUIT(st,0)}
if(! visitor.type_param_bound_or_default(st,tp.default_value,tp.name,tp)){VISIT_QUIT(st,0)}
break
case $B.ast.ParamSpec:
if(! symtable_add_def(st,tp.name,SF.DEF_TYPE_PARAM |SF.DEF_LOCAL,LOCATION(tp))){VISIT_QUIT(st,0)}
if(! visitor.type_param_bound_or_default(st,tp.default_value,tp.name,tp)){VISIT_QUIT(st,0)}
break}
VISIT_QUIT(st,1)}
visitor.pattern=function(st,p){switch(p.constructor){case $B.ast.MatchValue:
VISIT(st,expr,p.value)
break
case $B.ast.MatchSingleton:
break
case $B.ast.MatchSequence:
VISIT_SEQ(st,pattern,p.patterns)
break
case $B.ast.MatchStar:
if(p.name){symtable_add_def(st,p.name,SF.DEF_LOCAL,LOCATION(p))}
break
case $B.ast.MatchMapping:
VISIT_SEQ(st,expr,p.keys)
VISIT_SEQ(st,pattern,p.patterns)
if(p.rest){symtable_add_def(st,p.rest,SF.DEF_LOCAL,LOCATION(p))}
break
case $B.ast.MatchClass:
VISIT(st,expr,p.cls)
VISIT_SEQ(st,pattern,p.patterns)
VISIT_SEQ(st,pattern,p.kwd_patterns)
break
case $B.ast.MatchAs:
if(p.pattern){VISIT(st,pattern,p.pattern)}
if(p.name){symtable_add_def(st,p.name,SF.DEF_LOCAL,LOCATION(p))}
break
case $B.ast.MatchOr:
VISIT_SEQ(st,pattern,p.patterns)
break}
VISIT_QUIT(st,1)}
function symtable_implicit_arg(st,pos){var id='.'+pos
if(!symtable_add_def(st,id,SF.DEF_PARAM,ST_LOCATION(st.cur))){return 0}
return 1}
visitor.params=function(st,args){if(! args){return-1}
for(var arg of args){if(! symtable_add_def(st,arg.arg,SF.DEF_PARAM,LOCATION(arg)))
return 0}
return 1}
visitor.annotation=function(st,annotation){var future_annotations=st.future.features & $B.CO_FUTURE_ANNOTATIONS
if(future_annotations &&
!symtable_enter_block(st,'_annotation',AnnotationBlock,annotation,annotation.lineno,annotation.col_offset,annotation.end_lineno,annotation.end_col_offset)){VISIT_QUIT(st,0)}
VISIT(st,expr,annotation)
if(future_annotations && !symtable_exit_block(st)){VISIT_QUIT(st,0)}
return 1}
visitor.argannotations=function(st,args){if(!args){return-1}
for(var arg of args){if(arg.annotation){VISIT(st,expr,arg.annotation)}}
return 1}
visitor.annotations=function(st,o,a,returns){var future_annotations=st.future.ff_features & $B.CO_FUTURE_ANNOTATIONS
if(future_annotations &&
!symtable_enter_block(st,'_annotation',AnnotationBlock,o,o.lineno,o.col_offset,o.end_lineno,o.end_col_offset)){VISIT_QUIT(st,0)}
if(a.posonlyargs && !visitor.argannotations(st,a.posonlyargs)){return 0}
if(a.args && !visitor.argannotations(st,a.args)){return 0}
if(a.vararg && a.vararg.annotation){VISIT(st,expr,a.vararg.annotation)}
if(a.kwarg && a.kwarg.annotation){VISIT(st,expr,a.kwarg.annotation)}
if(a.kwonlyargs && !visitor.argannotations(st,a.kwonlyargs)){return 0}
if(future_annotations && !symtable_exit_block(st)){VISIT_QUIT(st,0)}
if(returns && !visitor.annotation(st,returns)){VISIT_QUIT(st,0)}
return 1}
visitor.arguments=function(st,a){
if(a.posonlyargs && !visitor.params(st,a.posonlyargs)){return 0}
if(a.args && !visitor.params(st,a.args)){return 0}
if(a.kwonlyargs && !visitor.params(st,a.kwonlyargs)){return 0}
if(a.vararg){if(!symtable_add_def(st,a.vararg.arg,SF.DEF_PARAM,LOCATION(a.vararg))){return 0}
st.cur.varargs=1}
if(a.kwarg){if(!symtable_add_def(st,a.kwarg.arg,SF.DEF_PARAM,LOCATION(a.kwarg))){return 0}
st.cur.varkeywords=1}
return 1}
visitor.excepthandler=function(st,eh){if(eh.type){VISIT(st,expr,eh.type)}
if(eh.name){if(!symtable_add_def(st,eh.name,SF.DEF_LOCAL,LOCATION(eh))){return 0}}
VISIT_SEQ(st,stmt,eh.body)
return 1}
visitor.withitem=function(st,item){VISIT(st,expr,item.context_expr)
if(item.optional_vars){VISIT(st,expr,item.optional_vars)}
return 1}
visitor.match_case=function(st,m){VISIT(st,pattern,m.pattern)
if(m.guard){VISIT(st,expr,m.guard)}
VISIT_SEQ(st,stmt,m.body)
return 1}
visitor.alias=function(st,a){
var store_name,name=(a.asname==NULL ||a.asname===_b_.None)? a.name :a.asname
var dot=name.search('\\.')
if(dot !=-1){store_name=name.substring(0,dot)
if(!store_name){return 0}}else{
store_name=name}
if(name !="*"){var r=symtable_add_def(st,store_name,SF.DEF_IMPORT,LOCATION(a))
return r}else{
if(st.cur.type !=ModuleBlock){var lineno=a.lineno,col_offset=a.col_offset,end_lineno=a.end_lineno,end_col_offset=a.end_col_offset
var exc=PyErr_SetString(PyExc_SyntaxError,IMPORT_STAR_WARNING)
set_exc_info(exc,st.filename,lineno,col_offset,end_lineno,end_col_offset)
throw exc}
st.cur.$has_import_star=true
return 1}}
visitor.comprehension=function(st,lc){st.cur.comp_iter_target=1
VISIT(st,expr,lc.target)
st.cur.comp_iter_target=0
st.cur.comp_iter_expr++
VISIT(st,expr,lc.iter)
st.cur.comp_iter_expr--
VISIT_SEQ(st,expr,lc.ifs)
if(lc.is_async){st.cur.coroutine=1}
return 1}
visitor.keyword=function(st,k){VISIT(st,expr,k.value)
return 1}
function symtable_handle_comprehension(st,e,scope_name,generators,elt,value){var is_generator=(e.constructor===$B.ast.GeneratorExp)
var outermost=generators[0]
st.cur.comp_iter_expr++
VISIT(st,expr,outermost.iter)
st.cur.comp_iter_expr--
if(!scope_name ||
!symtable_enter_block(st,scope_name,FunctionBlock,e,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)){return 0}
switch(e.constructor){case $B.ast.ListComp:
st.cur.comprehension=ListComprehension
break
case $B.ast.SetComp:
st.cur.comprehension=SetComprehension
break
case $B.ast.DictComp:
st.cur.comprehension=DictComprehension
break
default:
st.cur.comprehension=GeneratorExpression
break}
if(outermost.is_async){st.cur.coroutine=1}
if(!symtable_implicit_arg(st,0)){symtable_exit_block(st)
return 0}
st.cur.comp_iter_target=1
VISIT(st,expr,outermost.target)
st.cur.comp_iter_target=0
VISIT_SEQ(st,expr,outermost.ifs)
VISIT_SEQ_TAIL(st,comprehension,generators,1)
if(value){VISIT(st,expr,value)}
VISIT(st,expr,elt)
st.cur.generator=is_generator
var is_async=st.cur.coroutine && !is_generator
if(!symtable_exit_block(st)){return 0}
if(is_async){st.cur.coroutine=1}
return 1}
visitor.genexp=function(st,e){return symtable_handle_comprehension(st,e,'genexpr',e.generators,e.elt,NULL)}
visitor.listcomp=function(st,e){return symtable_handle_comprehension(st,e,'listcomp',e.generators,e.elt,NULL)}
visitor.setcomp=function(st,e){return symtable_handle_comprehension(st,e,'setcomp',e.generators,e.elt,NULL)}
visitor.dictcomp=function(st,e){return symtable_handle_comprehension(st,e,'dictcomp',e.generators,e.key,e.value)}
function symtable_raise_if_annotation_block(st,name,e){var type=st.cur.type,exc
if(type==AnnotationBlock){exc=PyErr_Format(PyExc_SyntaxError,ANNOTATION_NOT_ALLOWED,name)}else if(type==TypeVarBoundBlock){exc=PyErr_Format(PyExc_SyntaxError,TYPEVAR_BOUND_NOT_ALLOWED,name)}else if(type==TypeAliasBlock){exc=PyErr_Format(PyExc_SyntaxError,TYPEALIAS_NOT_ALLOWED,name)}else if(type==TypeParamBlock){exc=PyErr_Format(PyExc_SyntaxError,TYPEPARAM_NOT_ALLOWED,name)}else{
return 1}
set_exc_info(exc,st.filename,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)
throw exc}
function symtable_raise_if_comprehension_block(st,e){var type=st.cur.comprehension
var exc=PyErr_SetString(PyExc_SyntaxError,(type==ListComprehension)? "'yield' inside list comprehension" :
(type==SetComprehension)? "'yield' inside set comprehension" :
(type==DictComprehension)? "'yield' inside dict comprehension" :
"'yield' inside generator expression")
exc.$frame_obj=$B.frame_obj
set_exc_info(exc,st.filename,e.lineno,e.col_offset,e.end_lineno,e.end_col_offset)
throw exc}})(__BRYTHON__);
;

(function($B){"use strict";
var _b_=$B.builtins,NULL=undefined,DOT='.',ELLIPSIS='...'
const STAR_TARGETS=1,DEL_TARGETS=2,FOR_TARGETS=3
function make_string_for_ast_value(value){value=value.replace(/\n/g,'\\n\\\n')
value=value.replace(/\r/g,'\\r\\\r')
if(value[0]=="'"){var unquoted=value.substr(1,value.length-2)
return unquoted}
if(value.indexOf("'")>-1){var s='',escaped=false
for(var char of value){if(char=='\\'){if(escaped){s+='\\\\'}
escaped=!escaped}else{
if(char=="'" && ! escaped){
s+='\\'}else if(escaped){s+='\\'}
s+=char
escaped=false}}
value=s}
return value.substr(1,value.length-2)}
var escapeseq={a:'\a',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v','"':'"',"'":"'"}
function encode_bytestring(s){var s1=''
var escape=false
for(var char of s){if(char=='\\'){if(escape){s1+=char}
escape=! escape}else if(escape){var repl=escapeseq[char]
s1+=repl ?? char
escape=false}else{
s1+=char}}
s=s1
var t=[]
for(var i=0,len=s1.length;i < len;i++){var cp=s1.codePointAt(i)
if(cp > 255){throw Error()}
t.push(cp)}
return t}
function EXTRA_EXPR(head,tail){return{
lineno:head.lineno,col_offset:head.col_offset,end_lineno:tail.end_lineno,end_col_offset:tail.end_col_offset}}
function set_list(list,other){for(var item of other){list.push(item)}}
var positions=['lineno','col_offset','end_lineno','end_col_offset']
function set_position_from_list(ast_obj,EXTRA){for(var i=0;i < 4;i++){ast_obj[positions[i]]=EXTRA[i]}}
function set_position_from_token(ast_obj,token){ast_obj.lineno=token.lineno
ast_obj.col_offset=token.col_offset
ast_obj.end_lineno=token.end_lineno
ast_obj.end_col_offset=token.end_col_offset}
function set_position_from_obj(ast_obj,obj){for(var position of positions){ast_obj[position]=obj[position]}}
function _get_names(p,names_with_defaults){var seq=[]
for(var pair of names_with_defaults){seq.push(pair.arg)}
return seq}
function _get_defaults(p,names_with_defaults){var seq=[]
for(var pair of names_with_defaults){seq.push(pair.value)}
return seq}
function _make_posonlyargs(p,slash_without_default,slash_with_default,posonlyargs){if(slash_without_default !=NULL){set_list(posonlyargs,slash_without_default)}else if(slash_with_default !=NULL){var slash_with_default_names=
_get_names(p,slash_with_default.names_with_defaults)
if(!slash_with_default_names){return-1}
set_list(posonlyargs,$B._PyPegen.join_sequences(
p,slash_with_default.plain_names,slash_with_default_names))}
return posonlyargs==NULL ?-1 :0}
function _make_posargs(p,plain_names,names_with_default,posargs){if(plain_names !=NULL && names_with_default !=NULL){var names_with_default_names=_get_names(p,names_with_default)
if(!names_with_default_names){return-1}
var seqs=$B._PyPegen.join_sequences(
p,plain_names,names_with_default_names)
set_list(posargs,seqs)}else if(plain_names==NULL && names_with_default !=NULL){set_list(posargs,_get_names(p,names_with_default))}else if(plain_names !=NULL && names_with_default==NULL){set_list(posargs,plain_names)}
return posargs==NULL ?-1 :0}
function _make_posdefaults(p,slash_with_default,names_with_default,posdefaults){if(slash_with_default !=NULL && names_with_default !=NULL){var slash_with_default_values=
_get_defaults(p,slash_with_default.names_with_defaults)
if(!slash_with_default_values){return-1}
var names_with_default_values=_get_defaults(p,names_with_default)
if(!names_with_default_values){return-1}
set_list(posdefaults,$B._PyPegen.join_sequences(
p,slash_with_default_values,names_with_default_values))}else if(slash_with_default==NULL && names_with_default !=NULL){set_list(posdefaults,_get_defaults(p,names_with_default))}else if(slash_with_default !=NULL && names_with_default==NULL){set_list(posdefaults,_get_defaults(p,slash_with_default.names_with_defaults))}
return posdefaults==NULL ?-1 :0}
function _make_kwargs(p,star_etc,kwonlyargs,kwdefaults){if(star_etc !=NULL && star_etc.kwonlyargs !=NULL){set_list(kwonlyargs,_get_names(p,star_etc.kwonlyargs))}else{
set_list(kwonlyargs,[])}
if(kwonlyargs==NULL){return-1}
if(star_etc !=NULL && star_etc.kwonlyargs !=NULL){set_list(kwdefaults,_get_defaults(p,star_etc.kwonlyargs))}else{
set_list(kwdefaults,[])}
if(kwdefaults==NULL){return-1}
return 0}
function _seq_number_of_starred_exprs(seq){var n=0
for(var k of seq){if(! k.is_keyword){n++}}
return n}
$B._PyPegen={}
$B._PyPegen.PyErr_Occurred=function(){
return false}
$B._PyPegen.constant_from_string=function(p,token){var prepared=$B.prepare_string(p,token)
var is_bytes=prepared.value.startsWith('b')
if(! is_bytes){var value=make_string_for_ast_value(prepared.value)}else{
var value=prepared.value.substr(2,prepared.value.length-3)
try{
value=_b_.bytes.$factory(encode_bytestring(value))}catch(err){$B._PyPegen.raise_error_known_location(p,_b_.SyntaxError,token.lineno,token.col_offset,token.end_lineno,token.end_col_offset,'bytes can only contain ASCII literal characters')}}
let kind=prepared.unicode ? 'u' :_b_.None
var ast_obj=new $B.ast.Constant(value,kind)
set_position_from_token(ast_obj,token)
return ast_obj}
$B._PyPegen.constant_from_token=function(p,t){var ast_obj=new $B.ast.Constant(t.string)
set_position_from_token(ast_obj,t)
return ast_obj}
$B._PyPegen.decoded_constant_from_token=function(p,t){var ast_obj=new $B.ast.Constant(t.string)
set_position_from_token(ast_obj,t)
return ast_obj}
function is_whitespace(char){return ' \n\r\t\f'.includes(char)}
function _get_interpolation_conversion(p,debug,conversion,format){if(conversion !=NULL){var conversion_expr=conversion.result
return conversion_expr.id}else if(debug && !format){
return 'r'}
return-1}
function _strip_interpolation_expr(exprstr){var len=exprstr.length
for(var c of[...exprstr].reverse()){if(is_whitespace(c)||c=='='){len--}else{
break}}
return exprstr.substr(0,len)}
$B._PyPegen.interpolation=function(p,expression,debug,conversion,format,closing_brace,position,arena){var lineno=position.lineno,col_offset=position.col_offset,end_lineno=position.end_lineno,end_col_offset=position.end_col_offset
var conversion_val=_get_interpolation_conversion(p,debug,conversion,format)
var debug_end_line,debug_end_offset
var debug_metadata
var exprstr
if(conversion){debug_end_line=conversion.result.lineno
debug_end_offset=conversion.result.col_offset
debug_metadata=exprstr=conversion.metadata}else if(format){debug_end_line=format.result.lineno
debug_end_offset=format.result.col_offset+1
debug_metadata=exprstr=format.metadata}else{
debug_end_line=end_lineno
debug_end_offset=end_col_offset
debug_metadata=exprstr=closing_brace.metadata}
var final_exprstr=_strip_interpolation_expr(exprstr)
if(final_exprstr){p.arena.a_objects.push(final_exprstr)}
var interpolation=$B._PyAST.Interpolation(
expression,final_exprstr,conversion_val,format ? format.result :NULL,position)
set_position_from_obj(interpolation,position)
if(!debug){return interpolation}
var debug_text=new $B.ast.Constant(debug_metadata)
set_position_from_list(debug_text,[lineno,col_offset+1,debug_end_line,debug_end_offset-1])
var values=[debug_text,interpolation]
var ast_obj=new $B.ast.JoinedStr(values)
set_position_from_list(ast_obj,[lineno,col_offset,debug_end_line,debug_end_offset])
return ast_obj}
$B._PyPegen.formatted_value=function(p,expression,debug,conversion,format,closing_brace,arena){var conversion_val=_get_interpolation_conversion(p,debug,conversion,format)
if(typeof conversion_val=='string'){
if(conversion_val.length > 1 ||! 'sra'.includes(conversion_val)){$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,conversion.result,`f-string: invalid conversion character '${conversion_val}': `+
"expected 's', 'r', or 'a'")}
conversion_val=conversion_val.charCodeAt(0)}
var formatted_value=new $B.ast.FormattedValue(expression,conversion_val,format===undefined ? format :format.result)
set_position_from_obj(formatted_value,arena)
if(debug){var debug_end_line,debug_end_offset,debug_metadata
if(conversion){debug_end_line=conversion.result.lineno
debug_end_offset=conversion.result.col_offset
debug_metadata=conversion.metadata}else if(format){debug_end_line=format.result.lineno
debug_end_offset=format.result.col_offset+1
debug_metadata=format.metadata}else{
debug_end_line=arena.end_lineno
debug_end_offset=arena.end_col_offset
debug_metadata=closing_brace.metadata}
debug_metadata=debug_metadata.replace(new RegExp("'","g"),"\\'")
var debug=new $B.ast.Constant(debug_metadata)
debug.lineno=arena.lineno
debug.col_offset=arena.col_offset+1
debug.end_lineno=debug_end_line
debug.end_col_offset=debug_end_offset-1
var joined_str=new $B.ast.JoinedStr([debug,formatted_value])
set_position_from_obj(joined_str,arena)
return joined_str}
return formatted_value}
$B._PyPegen.decode_fstring_part=function(p,is_raw,constant,token){var bstr=constant.value
var len
if(bstr=="{{" ||bstr=="}}"){len=1}else{
len=bstr.length}
is_raw=is_raw ||! bstr.includes('\\')
var str=bstr
if(str==NULL){_Pypegen_raise_decode_error(p)
return NULL}
p.arena.a_objects.push(str)
return $B._PyAST.Constant(str,NULL,constant.lineno,constant.col_offset,constant.end_lineno,constant.end_col_offset,p.arena)}
function _get_resized_exprs(p,a,raw_expressions,b,string_kind){var n_items=raw_expressions.length
var total_items=n_items
for(var item of raw_expressions){if(item instanceof $B.ast.JoinedStr){total_items+=item.values.length-1}}
var quote_str=a.bytes
if(quote_str==NULL){return NULL}
var is_raw=quote_str.includes('r')||quote_str.includes('R')
var seq=[]
var index=0
for(var i=0;i < n_items;i++){var item=raw_expressions[i]
if(item instanceof $B.ast.JoinedStr){var values=item.values
if(values.length !=2){PyErr_Format(PyExc_SystemError,string_kind==TSTRING
? "unexpected TemplateStr node without debug data in t-string at line %d"
:"unexpected JoinedStr node without debug data in f-string at line %d",item.lineno)
return NULL}
var first=values[0]
seq[index++]=first
var second=values[1]
seq[index++]=second
continue}
if(item instanceof $B.ast.Constant){item=$B._PyPegen.decode_fstring_part(p,is_raw,item,b)
if(item==NULL){return NULL}
if(item.value.length==0){continue}}
seq[index++]=item}
var resized_exprs
if(index !=total_items){resized_exprs=_Py_asdl_expr_seq_new(index,p.arena)
if(resized_exprs==NULL){return NULL}
for(var i=0;i < index;i++){resized_exprs[i]=seq[i]}}else{
resized_exprs=seq}
return resized_exprs}
$B._PyPegen.template_str=function(p,a,raw_expressions,b){var resized_exprs=_get_resized_exprs(p,a,raw_expressions,b,'TSTRING')
var ast_obj=new $B.ast.TemplateStr(resized_exprs)
set_position_from_list(ast_obj,[a.lineno,a.col_offset,b.end_lineno,b.end_col_offset])
return ast_obj}
$B._PyPegen.joined_str=function(p,a,items,c){var ast_obj=new $B.ast.JoinedStr(items)
ast_obj.lineno=a.lineno
ast_obj.col_offset=a.col_offset
ast_obj.end_lineno=c.end_lineno
ast_obj.end_col_offset=c.end_col_offset
return ast_obj}
$B._PyPegen.setup_full_format_spec=function(p,colon,spec,arena){var ast_obj=new $B.ast.JoinedStr(spec)
set_position_from_obj(ast_obj,arena)
return result_token_with_metadata(p,ast_obj,colon.metadata)}
function result_token_with_metadata(p,result,metadata){return{result,metadata}}
$B._PyPegen.check_fstring_conversion=function(p,conv_token,conv){if(conv_token.lineno !=conv.lineno ||
conv_token.end_col_offset !=conv.col_offset){$B._PyPegen.raise_error_known_location(p,_b_.SyntaxError,conv.lineno,conv.col_offset,conv.end_lineno,conv.end_col_offset,"f-string: conversion type must come right after the exclamanation mark"
)}
return result_token_with_metadata(p,conv,conv_token.metadata)}
$B._PyPegen.seq_count_dots=function(seq){if(seq===undefined){return 0}
var number_of_dots=0
for(var token of seq){if(token.num_type==$B.py_tokens.DOT){number_of_dots+=token.string.length}else if(token.num_type==$B.py_tokens.ELLIPSIS){number_of_dots+=3}}
return number_of_dots}
$B._PyPegen.map_names_to_ids=function(p,seq){return seq.map(e=> e.id)}
$B._PyPegen.alias_for_star=function(p,lineno,col_offset,end_lineno,end_col_offset,arena){var str="*"
return $B._PyAST.alias(str,NULL,lineno,col_offset,end_lineno,end_col_offset,arena)}
$B._PyPegen.cmpop_expr_pair=function(p,cmpop,expr){return{cmpop,expr}}
$B._PyPegen.get_cmpops=function(p,seq){var new_seq=[]
for(var pair of seq){new_seq.push(pair.cmpop)}
return new_seq}
$B._PyPegen.get_exprs=function(p,seq){var new_seq=[]
for(var pair of seq){new_seq.push(pair.expr)}
return new_seq}
function _set_seq_context(p,seq,ctx){var new_seq=[]
for(var e of seq){new_seq.push($B._PyPegen.set_expr_context(p,e,ctx))}
return new_seq}
function _set_name_context(p,e,ctx){return $B._PyAST.Name(e.id,ctx,EXTRA_EXPR(e,e))}
function _set_tuple_context(p,e,ctx){return $B._PyAST.Tuple(
_set_seq_context(p,e.elts,ctx),ctx,EXTRA_EXPR(e,e))}
function _set_list_context(p,e,ctx){return $B._PyAST.List(
_set_seq_context(p,e.elts,ctx),ctx,EXTRA_EXPR(e,e))}
function _set_subscript_context(p,e,ctx){return $B._PyAST.Subscript(e.value,e.slice,ctx,EXTRA_EXPR(e,e))}
function _set_attribute_context(p,e,ctx){return $B._PyAST.Attribute(e.value,e.attr,ctx,EXTRA_EXPR(e,e))}
function _set_starred_context(p,e,ctx){return $B._PyAST.Starred($B._PyPegen.set_expr_context(p,e.value,ctx),ctx,EXTRA_EXPR(e,e))}
$B._PyPegen.set_expr_context=function(p,expr,ctx){var _new=NULL
switch(expr.constructor){case $B.ast.Name:
_new=_set_name_context(p,expr,ctx)
break
case $B.ast.Tuple:
_new=_set_tuple_context(p,expr,ctx)
break
case $B.ast.List:
_new=_set_list_context(p,expr,ctx)
break
case $B.ast.Subscript:
_new=_set_subscript_context(p,expr,ctx)
break
case $B.ast.Attribute:
_new=_set_attribute_context(p,expr,ctx)
break
case $B.ast.Starred:
_new=_set_starred_context(p,expr,ctx)
break
default:
_new=expr}
return _new}
$B._PyPegen.key_value_pair=function(p,key,value){return{key,value}}
$B._PyPegen.get_expr_name=function(e){switch(e.constructor.$name){case 'Attribute':
case 'Subscript':
case 'Starred':
case 'Name':
case 'List':
case 'Tuple':
case 'Lambda':
return e.constructor.$name.toLowerCase()
case 'Call':
return "function call"
case 'BoolOp':
case 'BinOp':
case 'UnaryOp':
return "expression"
case 'GeneratorExp':
return "generator expression"
case 'Yield':
case 'YieldFrom':
return "yield expression"
case 'Await':
return "await expression"
case 'ListComp':
return "list comprehension"
case 'SetComp':
return "set comprehension"
case 'DictComp':
return "dict comprehension"
case 'Dict':
return "dict literal"
case 'Set':
return "set display"
case 'JoinedStr':
case 'FormattedValue':
return "f-string expression"
case 'Constant':
var value=e.value
if(value===_b_.None){return "None"}
if(value===false){return "False"}
if(value===true){return "True"}
if(value===_b_.Ellipsis){return "ellipsis"}
return "literal"
case 'Compare':
return "comparison"
case 'IfExp':
return "conditional expression"
case 'NamedExpr':
return "named expression"
default:
return NULL}}
$B._PyPegen.get_keys=function(p,seq){return seq===undefined ?[]:seq.map(pair=> pair.key)}
$B._PyPegen.get_values=function(p,seq){return seq===undefined ?[]:seq.map(pair=> pair.value)}
$B._PyPegen.key_pattern_pair=function(p,key,pattern){return{key,pattern}}
$B._PyPegen.get_pattern_keys=function(p,seq){return seq===undefined ?[]:seq.map(x=> x.key)}
$B._PyPegen.get_patterns=function(p,seq){return seq===undefined ?[]:seq.map(x=> x.pattern)}
$B._PyPegen.check_legacy_stmt=function(p,name){return["print","exec"].includes(name)}
$B._PyPegen.dummy_name=function(p){var cache=NULL
if(cache !=NULL){return cache}
var id="dummy"+Math.random().toString(36).substr(2),ast_obj=new $B.ast.Name(id,new $B.ast.Load())
set_position_from_list(ast_obj,[1,0,1,0])
return ast_obj}
$B._PyPegen.add_type_comment_to_arg=function(p,a,tc){if(tc==NULL){return a}
var bytes=_b_.bytes.$factory(tc),tco=$B._PyPegen.new_type_comment(p,bytes)
var ast_obj=$B._PyAST.arg(a.arg,a.annotation,tco,a.lineno,a.col_offset,a.end_lineno,a.end_col_offset,p.arena)
return ast_obj}
$B._PyPegen.check_barry_as_flufl=function(p,t){return false}
$B._PyPegen.empty_arguments=function(p){return $B._PyAST.arguments([],[],NULL,[],[],NULL,[],p.arena)}
$B._PyPegen.augoperator=function(p,kind){return{kind}}
$B._PyPegen.function_def_decorators=function(p,decorators,function_def){var constr=function_def instanceof $B.ast.AsyncFunctionDef ?
$B.ast.AsyncFunctionDef :$B.ast.FunctionDef
var ast_obj=new constr(
function_def.name,function_def.args,function_def.body,decorators,function_def.returns,function_def.type_comment,function_def.type_params,p.arena)
for(var position of positions){ast_obj[position]=function_def[position]}
return ast_obj}
$B._PyPegen.class_def_decorators=function(p,decorators,class_def){var ast_obj=$B._PyAST.ClassDef(
class_def.name,class_def.bases,class_def.keywords,class_def.body,decorators,class_def.type_params,p.arena)
set_position_from_obj(ast_obj,class_def)
return ast_obj}
$B._PyPegen.keyword_or_starred=function(p,element,is_keyword){return{
element,is_keyword}}
$B._PyPegen.make_arguments=function(p,slash_without_default,slash_with_default,plain_names,names_with_default,star_etc){
var posonlyargs=[]
if(_make_posonlyargs(p,slash_without_default,slash_with_default,posonlyargs)==-1){return NULL}
var posargs=[]
if(_make_posargs(p,plain_names,names_with_default,posargs)==-1){return NULL}
var posdefaults=[]
if(_make_posdefaults(p,slash_with_default,names_with_default,posdefaults)==-1){return NULL}
var vararg=NULL
if(star_etc !=NULL && star_etc.vararg !=NULL){vararg=star_etc.vararg}
var kwonlyargs=[],kwdefaults=[]
if(_make_kwargs(p,star_etc,kwonlyargs,kwdefaults)==-1){return NULL}
var kwarg=NULL
if(star_etc !=NULL && star_etc.kwarg !=NULL){kwarg=star_etc.kwarg}
var ast_obj=$B._PyAST.arguments(posonlyargs,posargs,vararg,kwonlyargs,kwdefaults,kwarg,posdefaults,p.arena)
return ast_obj}
$B._PyPegen.name_default_pair=function(p,arg,value,tc){return{
arg:$B._PyPegen.add_type_comment_to_arg(p,arg,tc),value:value}}
$B._PyPegen.raise_error=function(p,errtype,errmsg){if(p.fill==0){var va=[errmsg]
$B._PyPegen.raise_error_known_location(p,errtype,0,0,0,-1,errmsg,va)
return NULL}
var t=p.known_err_token !=NULL ? p.known_err_token :p.tokens[p.fill-1]
var va=errmsg
$B._PyPegen.raise_error_known_location(p,errtype,t.lineno,t.col_offset,t.end_lineno,t.end_col_offset,errmsg,va)}
$B._PyPegen.raise_error_known_location=function(p,errtype,lineno,col_offset,end_lineno,end_col_offset,errmsg,va){var exc=$B.EXC(errtype,errmsg)
exc.filename=p.filename
if(p.known_err_token){var token=p.known_err_token
exc.lineno=token.lineno
exc.offset=token.col_offset+1
exc.end_lineno=token.end_lineno
exc.end_offset=token.end_col_offset
exc.text=token.line}else{
exc.lineno=lineno
exc.offset=col_offset+1
exc.end_lineno=end_lineno
exc.end_offset=end_col_offset+1
var src=$B.file_cache[p.filename]
if(src !==undefined){var lines=src.split('\n'),line=lines[exc.lineno-1]
exc.text=line+'\n'}else{
exc.text=_b_.None}}
exc.args[1]=$B.fast_tuple([p.filename,exc.lineno,exc.offset,exc.text,exc.end_lineno,exc.end_offset])
throw exc}
$B._PyPegen.seq_delete_starred_exprs=function(p,kwargs){var len=kwargs.length,new_len=len-_seq_number_of_starred_exprs(kwargs)
if(new_len==0){return NULL}
var new_seq=[]
for(var k of kwargs){if(k.is_keyword){new_seq.push(k.element)}}
return new_seq}
$B._PyPegen.seq_extract_starred_exprs=function(p,kwargs){var new_len=_seq_number_of_starred_exprs(kwargs)
if(new_len==0){return NULL}
var new_seq=[]
var idx=0
for(var k of kwargs){if(! k.is_keyword){new_seq[idx++]=k.element}}
return new_seq}
$B._PyPegen.slash_with_default=function(p,plain_names,names_with_defaults){return{plain_names,names_with_defaults}}
$B._PyPegen.star_etc=function(p,vararg,kwonlyargs,kwarg){return{vararg,kwonlyargs,kwarg}}
$B._PyPegen.collect_call_seqs=function(p,a,b,lineno,col_offset,end_lineno,end_col_offset,arena){var args_len=a.length,total_len=args_len
if(b==NULL){return $B._PyAST.Call($B._PyPegen.dummy_name(p),a,[],lineno,col_offset,end_lineno,end_col_offset,arena)}
var starreds=$B._PyPegen.seq_extract_starred_exprs(p,b),keywords=$B._PyPegen.seq_delete_starred_exprs(p,b)
if(starreds){total_len+=starreds.length}
var args=[]
for(var i=0;i < args_len;i++){args[i]=a[i]}
for(;i < total_len;i++){args[i]=starreds[i-args_len]}
return $B._PyAST.Call($B._PyPegen.dummy_name(p),args,keywords,lineno,col_offset,end_lineno,end_col_offset,arena)}
$B._PyPegen.join_sequences=function(p,a,b){return a.concat(b)}
function make_conversion_code(conv){switch(conv){case null:
return-1
case 'a':
return 97
case 'r':
return 114
case 's':
return 115}}
function make_formatted_value(p,fmt_values){
if(! fmt_values){return}
var seq=[]
for(var item of fmt_values){if(typeof item=='string'){var fmt_ast=new $B.ast.Constant(item)
set_position_from_obj(fmt_ast,p.arena)}else{
var src=item.expression.trimStart()
var _ast=new $B.Parser(src,p.filename,'eval').parse()
var raw_value=_ast.body
var fmt_ast=new $B.ast.FormattedValue(raw_value,make_conversion_code(item.conversion),make_formatted_value(p,item.fmt))
set_position_from_obj(fmt_ast,_ast)}
seq.push(fmt_ast)}
var ast_obj=new $B.ast.JoinedStr(seq)
set_position_from_obj(ast_obj,p.arena)
return ast_obj}
function _build_concatenated_str(p,strings){var len=strings.length
var n_flattened_elements=0
for(var elem of strings){if(elem instanceof $B.ast.JoinedStr ||
elem instanceof $B.ast.TemplateStr){n_flattened_elements+=elem.values.length}else{
n_flattened_elements++}}
var flattened=[]
var current_pos=0
for(var elem of strings){if(elem instanceof $B.ast.JoinedStr ||
elem instanceof $B.ast.TemplateStr){for(var subvalue of elem.values){flattened[current_pos++]=subvalue}}else{
flattened[current_pos++]=elem}}
var n_elements=0
var prev_is_constant=0
for(var elem of flattened){
if(elem instanceof $B.ast.Constant &&
typeof elem.value=='string' &&
elem.value.length==0){continue}
if(!prev_is_constant ||!(elem instanceof $B.ast.Constant)){n_elements++}
prev_is_constant=elem instanceof $B.ast.Constant}
var values=[]
current_pos=0
for(var i=0,len=flattened.length;i < len;i++){var elem=flattened[i]
if(elem instanceof $B.ast.Constant){if(i+1 < n_flattened_elements &&
flattened[i+1]instanceof $B.ast.Constant){var first_elem=elem
var kind=$B.get_class(elem.value)
var concat_str=''
var last_elem=elem
var j
for(j=i;j < n_flattened_elements;j++){var current_elem=flattened[j]
if(current_elem instanceof $B.ast.Constant){concat_str+=current_elem.value
last_elem=current_elem}else{
break}}
i=j-1
p.arena.a_objects.push(concat_str)
elem=new $B.ast.Constant(concat_str,kind)
set_position_from_list(elem,[first_elem.lineno,first_elem.col_offset,last_elem.end_lineno,last_elem.end_col_offset])}
if(elem.value.length==0){continue}}
values[current_pos++]=elem}
return values}
function _build_concatenated_template_str(p,strings){var values=_build_concatenated_str(p,strings)
var ast_obj=new $B.ast.TemplateStr(values)
var last=strings[strings.length-1]
set_position_from_list(ast_obj,[strings[0].lineno,strings[0].col_offset,last.end_lineno,last.end_col_offset])
return ast_obj}
function _build_concatenated_joined_str(p,strings){var values=_build_concatenated_str(p,strings)
var ast_obj=new $B.ast.JoinedStr(values)
var last=strings[strings.length-1]
set_position_from_list(ast_obj,[strings[0].lineno,strings[0].col_offset,last.end_lineno,last.end_col_offset])
return ast_obj}
$B._PyPegen.concatenate_strings=function(p,strings){var res='',first=strings[0],last=$B.last(strings),type
var state=NULL,value,values=[]
function error(message){var a={lineno:first.lineno,col_offset:first.col_offset,end_lineno :last.end_lineno,end_col_offset:last.end_col_offset}
$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,message)}
function set_position_from_list(ast_obj,items){var first=items[0],last=items[items.length-1]
ast_obj.lineno=first.lineno
ast_obj.col_offset=first.col_offset
ast_obj.end_lineno=last.end_lineno
ast_obj.end_col_offset=last.end_col_offset}
function escape_single_quotes(token){for(var fs_item of token.values){if(fs_item instanceof $B.ast.Constant){
var parts=fs_item.value.split('\\\'')
parts=parts.map(x=> x.replace(new RegExp("'","g"),"\\'"))
fs_item.value=parts.join('\\\'')
fs_item.value=fs_item.value.replace(/\n/g,'\\n')
.replace(/\r/g,'\\r')}}}
var items=[],has_fstring=false,has_tstring=false,state
for(var string of strings){if(string instanceof $B.ast.JoinedStr){
has_fstring=true
if(state=='bytestring'){error('cannot mix bytes and nonbytes literals')}
escape_single_quotes(string)
state='string'}else if(string instanceof $B.ast.TemplateStr){
has_tstring=true
if(state=='bytestring'){error('cannot mix bytes and nonbytes literals')}
escape_single_quotes(string)
state='string'}else{
items.push(string)
var is_bytes=$B.exact_type(string.value,_b_.bytes)
if((is_bytes && state=='string')||
(state=='bytestring' && ! is_bytes)){error('cannot mix bytes and nonbytes literals')}
state=is_bytes ? 'bytestring' :'string'}}
if(state=='bytestring'){
var bytes=[]
for(var item of items){bytes=bytes.concat(item.value.source)}
value=_b_.bytes.$factory(bytes)
var ast_obj=new $B.ast.Constant(value)
set_position_from_list(ast_obj,items)
return ast_obj}
function group_consec_strings(items){if(items.length==1){return items[0]}
var values=items.map(x=> x.value)
let ast_obj=new $B.ast.Constant(values.join(''))
set_position_from_list(ast_obj,items)
return ast_obj}
var items1=[],consec_strs=[],item_type=null
for(var i=0,len=items.length;i < len;i++){item=items[i]
if(item_type===null){item_type=Object.getPrototypeOf(item)}
if(item instanceof $B.ast.Constant){consec_strs.push(item)}else{
if(consec_strs.length > 0){items1.push(group_consec_strings(consec_strs))}
consec_strs=[]
items1.push(item)}}
if(consec_strs.length > 0){items1.push(group_consec_strings(consec_strs))}
if(! has_fstring && ! has_tstring){return items1[0]}
if(has_tstring){return _build_concatenated_template_str(p,strings)}
return _build_concatenated_joined_str(p,strings)}
$B._PyPegen.concatenate_tstrings=$B._PyPegen.concatenate_strings
$B._PyPegen.checked_future_import=function(p,module,names,level,lineno,col_offset,end_lineno,end_col_offset,arena){if(level==0 && module=="__future__"){for(var i=0;i < names.length;i++){var alias=names[i]
if(alias.name=="barry_as_FLUFL"){p.flags |=PyPARSE_BARRY_AS_BDFL}}}
return $B._PyAST.ImportFrom(module,names,level,lineno,col_offset,end_lineno,end_col_offset,arena)}
$B._PyPegen.register_stmts=function(p,stmts){if(! p.call_invalid_rules){return stmts}
var len=stmts.length
if(len==0){return stmts}
var last_stmt=stmts[len-1]
p.last_stmt_location.lineno=last_stmt.lineno
p.last_stmt_location.col_offset=last_stmt.col_offset
p.last_stmt_location.end_lineno=last_stmt.end_lineno
p.last_stmt_location.end_col_offset=last_stmt.end_col_offset
return stmts}
$B._PyPegen.ensure_imaginary=function(p,exp){if(!(exp instanceof $B.ast.Constant)||
! $B.exact_type(exp.value,_b_.complex)){$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,exp,"imaginary number required in complex literal")
return NULL}
return exp}
$B._PyPegen.ensure_real=function(p,exp){if(!(exp instanceof $B.ast.Constant)||exp.value.type=='imaginary'){$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(
p,exp,"real number required in complex literal")
return NULL}
return exp}
$B._PyPegen.set_expr_context=function(p,a,ctx){a.ctx=ctx
return a}
$B._PyPegen.singleton_seq=function(p,a){return[a]}
$B._PyPegen.seq_insert_in_front=function(p,a,seq){return seq ?[a].concat(seq):[a]}
$B._PyPegen.seq_flatten=function(p,seqs){var res=[]
for(var seq of seqs){for(var item of seq){res.push(item)}}
return res}
$B._PyPegen.join_names_with_dot=function(p,first_name,second_name){var str=first_name.id+'.'+second_name.id
return $B._PyAST.Name(str,new $B.ast.Load(),EXTRA_EXPR(first_name,second_name))}
$B._PyPegen.make_module=function(p,a){return new $B.ast.Module(a)}
$B._PyPegen.new_type_comment=function(p,s){if(s.length===0){return NULL}
return s}
$B._PyPegen.get_last_comprehension_item=function(comprehension){if(comprehension.ifs==NULL ||comprehension.ifs.length==0){return comprehension.iter}
return $B.last(comprehension.ifs)}
$B._PyPegen.arguments_parsing_error=function(p,e){var kwarg_unpacking=0
for(let keyword of e.keywords){if(! keyword.arg){kwarg_unpacking=1}}
var msg=NULL
if(kwarg_unpacking){msg="positional argument follows keyword argument unpacking"}else{
msg="positional argument follows keyword argument"}
return $B.helper_functions.RAISE_SYNTAX_ERROR(p,msg)}
$B._PyPegen.nonparen_genexp_in_call=function(p,args,comprehensions){
var len=args.args.length
if(len <=1){return NULL}
var last_comprehension=$B.last(comprehensions)
return $B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,args.args[len-1],$B._PyPegen.get_last_comprehension_item(last_comprehension),"Generator expression must be parenthesized"
)}
$B._PyPegen.get_invalid_target=function(e,targets_type){if(e==NULL){return NULL}
function VISIT_CONTAINER(CONTAINER,TYPE){for(var elt of CONTAINER.elts){var child=$B._PyPegen.get_invalid_target(elt,targets_type)
if(child !=NULL){return child}}}
switch(e.constructor){case $B.ast.List:
case $B.ast.Tuple:
return VISIT_CONTAINER(e,e.constructor)
case $B.ast.Starred:
if(targets_type==DEL_TARGETS){return e}
return $B._PyPegen.get_invalid_target(e.value,targets_type)
case $B.ast.Compare:
if(targets_type==FOR_TARGETS){var cmpop=e.ops[0]
if(cmpop instanceof $B.ast.In){return $B._PyPegen.get_invalid_target(e.left,targets_type)}
return NULL}
return e
case $B.ast.Name:
case $B.ast.Subscript:
case $B.ast.Attribute:
return NULL
default:
return e}}})(__BRYTHON__);
;
"use strict";
(function($B){var _b_=$B.builtins
var s_escaped='abfnrtvxuU"0123456789'+"'"+'\\',is_escaped={}
for(var i=0;i < s_escaped.length;i++){is_escaped[s_escaped.charAt(i)]=true}
function escaped_to_byte(char){var table={a:7,b:8,f:12,n:10,r:13,t:9,v:11}
if(table[char]!==undefined){return table[char]}
return char.charCodeAt(0)}
function to_bytes(s){var pos=0,bytes=[]
while(pos < s.length){if(s[pos]=='\\'){bytes[bytes.length]=escaped_to_byte(s[pos+1])
pos+=2}else{
bytes[bytes.length]=s.charCodeAt(pos)
pos++}}
return bytes}
function string_error(p,token,msg){$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,token,msg)}
function SurrogatePair(value){this.value=value}
function test_escape(p,token,context,text,string_start,antislash_pos){
var seq_end,mo
mo=/^[0-7]{1,3}/.exec(text.substr(antislash_pos+1))
if(mo){if(mo[0].length==3 && mo[0][0]>='4'){$B.warn(_b_.SyntaxWarning,`invalid octal escape sequence '\\${mo[0]}'`,p.filename,token)}
return[String.fromCharCode(parseInt(mo[0],8)),1+mo[0].length]}
switch(text[antislash_pos+1]){case "x":
var mo=/^[0-9A-F]{0,2}/i.exec(text.substr(antislash_pos+2))
if(mo[0].length !=2){seq_end=antislash_pos+mo[0].length+1
string_error(p,token,["(unicode error) 'unicodeescape' codec can't decode "+
`bytes in position ${antislash_pos}-${seq_end}: truncated `+
"\\xXX escape"])}else{
return[String.fromCharCode(parseInt(mo[0],16)),2+mo[0].length]}
case "u":
var mo=/^[0-9A-F]{0,4}/i.exec(text.substr(antislash_pos+2))
if(mo[0].length !=4){seq_end=antislash_pos+mo[0].length+1
string_error(p,token,["(unicode error) 'unicodeescape' codec can't decode "+
`bytes in position ${antislash_pos}-${seq_end}: truncated `+
"\\uXXXX escape"])}else{
return[String.fromCharCode(parseInt(mo[0],16)),2+mo[0].length]}
case "U":
var mo=/^[0-9A-F]{0,8}/i.exec(text.substr(antislash_pos+2))
if(mo[0].length !=8){seq_end=antislash_pos+mo[0].length+1
string_error(p,token,["(unicode error) 'unicodeescape' codec can't decode "+
`bytes in position ${antislash_pos}-${seq_end}: truncated `+
"\\UXXXXXXXX escape"])}else{
var value=parseInt(mo[0],16)
if(value > 0x10FFFF){string_error(p,token,'invalid unicode escape '+mo[0])}else if(value >=0x10000){return[new SurrogatePair(value),2+mo[0].length]}else{
return[String.fromCharCode(value),2+mo[0].length]}}}}
$B.prepare_string=function(p,token){var s=token.string,len=s.length,pos=0,string_modifier,_type="string",quote,inner,context={type:'str'}
while(pos < len){if(s[pos]=='"' ||s[pos]=="'"){quote=s[pos]
string_modifier=s.substr(0,pos)
if(s.substr(pos,3)==quote.repeat(3)){_type="triple_string"
inner=s.substring(pos+3,s.length-3)}else{
inner=s.substring(pos+quote.length,len-quote.length)}
break}
pos++}
var result={quote}
var mods={r:'raw',f:'fstring',b:'bytes',u:'unicode'}
for(var mod of string_modifier){result[mods[mod]]=true}
var raw=context.type=='str' && context.raw,string_start=pos+1,bytes=false,fstring=false,sm_length,
end=null
if(string_modifier){switch(string_modifier){case 'r':
raw=true
break
case 'u':
break
case 'b':
bytes=true
break
case 'rb':
case 'br':
bytes=true
raw=true
break
case 'f':
fstring=true
sm_length=1
break
case 'fr':
case 'rf':
fstring=true
sm_length=2
raw=true
break}
string_modifier=false}
var escaped=false,zone='',end=0,src=inner
if(bytes){var source=[]}
while(end < src.length){if(escaped){if(src.charAt(end)=="a" && ! raw){zone=zone.substr(0,zone.length-1)+"\u0007"}else{
zone+=src.charAt(end)
if(raw && src.charAt(end)=='\\'){zone+='\\'}}
escaped=false
end++}else if(src.charAt(end)=="\\"){if(raw){if(end < src.length-1 &&
src.charAt(end+1)==quote){zone+='\\\\'+quote
end+=2}else{
zone+='\\\\'
end++}
escaped=true}else{
if(src.charAt(end+1)=='\n'){
end+=2}else if(src.substr(end+1,2)=='N{'){
var end_lit=end+3,re=new RegExp("[-a-zA-Z0-9 ]+"),search=re.exec(src.substr(end_lit))
if(search===null){string_error(p,token,"(unicode error) "+
"malformed \\N character escape",pos)}
var end_lit=end_lit+search[0].length
if(src.charAt(end_lit)!="}"){string_error(p,token,"(unicode error) "+
"malformed \\N character escape")}
var description=search[0].toUpperCase()
if($B.unicodedb===undefined){var xhr=new XMLHttpRequest
xhr.open("GET",$B.brython_path+"unicode.txt",false)
xhr.onreadystatechange=function(){if(this.readyState==4){if(this.status==200){$B.unicodedb=this.responseText}else{
console.log("Warning - could not "+
"load unicode.txt")}}}
xhr.send()}
if($B.unicodedb !==undefined){var re=new RegExp("^([0-9A-F]+);"+
description+";.*$","m")
search=re.exec($B.unicodedb)
if(search===null){string_error(p,token,"(unicode error) "+
"unknown Unicode character name")}
var cp=parseInt(search[1],16)
zone+=String.fromCodePoint(cp)
end=end_lit+1}else{
end++}}else{
var esc=test_escape(p,token,context,src,string_start,end)
if(esc){if(esc[0]=='\\'){zone+='\\\\'}else if(esc[0]instanceof SurrogatePair){zone+=String.fromCodePoint(esc[0].value)}else{
zone+=esc[0]}
end+=esc[1]}else{
if(end < src.length-1 &&
is_escaped[src.charAt(end+1)]===undefined){zone+='\\'}
zone+='\\'
escaped=true
end++}}}}else if(src.charAt(end)=='\n' && _type !='triple_string'){
console.log(pos,end,src.substring(pos,end))
string_error(p,token,["EOL while scanning string literal"])}else{
zone+=src.charAt(end)
end++}}
var $string=zone,string=''
for(var i=0;i < $string.length;i++){var $car=$string.charAt(i)
if($car==quote){if(raw ||(i==0 ||
$string.charAt(i-1)!='\\')){string+='\\'}else if(_type=="triple_string"){
var j=i-1
while($string.charAt(j)=='\\'){j--}
if((i-j-1)% 2==0){string+='\\'}}}
string+=$car}
if(fstring){try{
var re=new RegExp("\\\\"+quote,"g"),string_no_bs=string.replace(re,quote)
var elts=$B.parse_fstring(string_no_bs)}catch(err){string_error(p,token,err.message)}}
if(bytes){result.value='b'+quote+string+quote
result.bytes=to_bytes(string)}else if(fstring){result.value=elts}else{
result.value=quote+string+quote}
context.raw=raw
return result}})(__BRYTHON__);
;
"use strict";
(function($B){function test_num(num_lit){var len=num_lit.length,pos=0,char,elt=null,subtypes={b:'binary',o:'octal',x:'hexadecimal'},digits_re=/[_\d]/
function error(message){throw SyntaxError(message)}
function check(elt){if(elt.value.length==0){var t=subtypes[elt.subtype]||'decimal'
error("invalid "+t+" literal")}else if(elt.value[elt.value.length-1].match(/[\-+_]/)){var t=subtypes[elt.subtype]||'decimal'
error("invalid "+t+" literal")}else{
elt.value=elt.value.replace(/_/g,"")
elt.length=pos
return elt}}
while(pos < len){var char=num_lit[pos]
if(char.match(digits_re)){if(elt===null){elt={value:char}}else{
if(char=='_' && elt.value.match(/[._+\-]$/)){
error('consecutive _ at '+pos)}else if(char=='_' && elt.subtype=='float' &&
elt.value.match(/e$/i)){
error('syntax error')}else if(elt.subtype=='b' && !(char.match(/[01_]/))){error(`invalid digit '${char}' in binary literal`)}else if(elt.subtype=='o' && !(char.match(/[0-7_]/))){error(`invalid digit '${char}' in octal literal`)}else if(elt.subtype===undefined && elt.value.startsWith("0")&&
!char.match(/[0_]/)){error("leading zeros in decimal integer literals are not"+
" permitted; use an 0o prefix for octal integers")}
elt.value+=char}
pos++}else if(char.match(/[oxb]/i)){if(elt.value=="0"){elt.subtype=char.toLowerCase()
if(elt.subtype=="x"){digits_re=/[_\da-fA-F]/}
elt.value=''
pos++}else{
error("invalid char "+char)}}else if(char=='.'){if(elt===null){error("invalid char in "+num_lit+" pos "+pos+": "+char)}else if(elt.subtype===undefined){elt.subtype="float"
if(elt.value.endsWith('_')){error("invalid decimal literal")}
elt.value=elt.value.replace(/_/g,"")+char
pos++}else{
return check(elt)}}else if(char.match(/e/i)){if(num_lit[pos+1]===undefined){error("nothing after e")}else if(elt && subtypes[elt.subtype]!==undefined){
error("syntax error")}else if(elt && elt.value.endsWith('_')){
error("syntax error")}else if(num_lit[pos+1].match(/[+\-0-9_]/)){if(elt && elt.value){if(elt.exp){elt.length=pos
return elt}
elt.subtype='float'
elt.value+=char
elt.exp=true
pos++}else{
error("unexpected e")}}else{
return check(elt)}}else if(char.match(/[\+\-]/i)){if(elt===null){elt={value:char}
pos++}else if(elt.value.search(/e$/i)>-1){elt.value+=char
pos++}else{
return check(elt)}}else if(char.match(/j/i)){if(elt &&(! elt.subtype ||elt.subtype=="float")){elt.imaginary=true
check(elt)
elt.length++
return elt}else{
error("invalid syntax")}}else{
break}}
return check(elt)}
$B.prepare_number=function(n){
n=n.replace(/_/g,"")
if(n.startsWith('.')){if(n.endsWith("j")){return{type:'imaginary',value:$B.prepare_number(n.substr(0,n.length-1))}}else{
return{type:'float',value:n+''}}
pos=j}else if(n.startsWith('0')&& n !='0'){
var num=test_num(n),base
if(num.imaginary){return{type:'imaginary',value:$B.prepare_number(num.value)}}
if(num.subtype=='float'){return{type:num.subtype,value:num.value+''}}
if(num.subtype===undefined){base=10}else{
base={'b':2,'o':8,'x':16}[num.subtype]}
if(base !==undefined){return{type:'int',value:[base,num.value]}}}else{
var num=test_num(n)
if(num.subtype=="float"){if(num.imaginary){return{
type:'imaginary',value:$B.prepare_number(num.value)}}else{
return{
type:'float',value:num.value+''}}}else{
if(num.imaginary){return{
type:'imaginary',value:$B.prepare_number(num.value)}}else{
return{
type:'int',value:[10,num.value]}}}}}})(__BRYTHON__);
;

(function($B){"use strict";
var _b_=$B.builtins,debug=0
var p={feature_version:$B.version_info[1]}
$B.parser_constants={Store:new $B.ast.Store(),Load:new $B.ast.Load(),Del:new $B.ast.Del(),NULL:undefined,alias_ty:$B.ast.alias,keyword_ty:$B.ast.keyword,arguments_ty:$B.ast.arguments,expr_ty:$B.ast.expr,asdl_stmt_seq:Array,asdl_int_seq:Array,asdl_expr_seq:Array,asdl_keyword_seq:Array,asdl_identifier_seq:Array,asdl_pattern_seq:Array,asdl_type_param_seq:Array,AugOperator:$B.ast.AugAssign,IsNot:$B.ast.IsNot,Py_Ellipsis:_b_.Ellipsis,Py_False:false,Py_True:true,Py_None:_b_.None,PyExc_SyntaxError:_b_.SyntaxError,STAR_TARGETS:1,DEL_TARGETS:2,FOR_TARGETS:3,PyBytes_AS_STRING:(b)=> b}
for(var op_type of $B.op_types){for(var key in op_type){var klass_name=op_type[key]
$B.parser_constants[klass_name]=new $B.ast[klass_name]()}}
var NULL=$B.parser_constants.NULL
$B._PyAST={}
for(var ast_class in $B.ast_classes){
var args=$B.ast_classes[ast_class]
if(Array.isArray(args)){continue}
args=args.replace(/\*/g,'').replace(/\?/g,'')
var arg_names=args.split(',')
$B._PyAST[ast_class]=(function(ast_name,ast_args){return function(){var _args=Array.from(arguments).slice(0,ast_args.length+1)
var EXTRA=_args.pop()
var ast_obj=new $B.ast[ast_name](..._args)
set_position_from_EXTRA(ast_obj,EXTRA)
return ast_obj}})(ast_class,arg_names)}
function get_last_token(p){var last_token=$B.last(p.tokens)
if(last_token.type=="ENDMARKER"){var src=$B.file_cache[p.filename]
if(src){for(var token of $B.tokenizer(src)){if(token.type=="ENDMARKER"){break}
if(token.type !="DEDENT"){last_token=token}}}else{
last_token=undefined}}
p.known_err_token=last_token}
var helper_functions={CHECK:function(type,obj){if(Array.isArray(type)){var check
for(var t of type){check=helper_functions.CHECK(t,obj)
if(check){return check}}
return undefined}
if(obj instanceof type){return obj}
return undefined},CHECK_VERSION:function(type,version,msg,node){return helper_functions.INVALID_VERSION_CHECK(p,version,msg,node)},CHECK_NULL_ALLOWED:function(type,obj){if(obj !==NULL){if(type instanceof Array){for(var t of type){if(obj instanceof t){return obj}}
return}else{
return obj instanceof type ? obj :undefined}}
return obj},INVALID_VERSION_CHECK:function(p,version,msg,node){if(node==NULL){p.error_indicator=1;
return NULL}
if(p.feature_version < version){p.error_indicator=1
return helper_functions.RAISE_SYNTAX_ERROR(
"%s only supported in Python 3.%i and greater",msg,version
)}
return node},NEW_TYPE_COMMENT:function(p,x){return x},PyErr_Occurred:function(){return false},RAISE_ERROR_KNOWN_LOCATION:function(p,errtype,lineno,col_offset,end_lineno,end_col_offset,errmsg){var va=[errmsg]
$B._PyPegen.raise_error_known_location(p,errtype,lineno,col_offset,end_lineno,end_col_offset,errmsg,va)
return NULL},RAISE_ERROR:function(p,errtype,msg){var extra_args=[]
for(var i=1,len=arguments.length;i < len;i++){extra_args.push(arguments[i])}
get_last_token(p)
$B._PyPegen.raise_error(p,errtype,msg,...extra_args)},RAISE_SYNTAX_ERROR:function(p,msg){var extra_args=[]
for(var i=1,len=arguments.length;i < len;i++){extra_args.push(arguments[i])}
get_last_token(p)
$B._PyPegen.raise_error(p,_b_.SyntaxError,msg,...extra_args)},RAISE_INDENTATION_ERROR:function(p,msg,arg){if(arg !==undefined){msg=_b_.str.nb_remainder(msg,arg)}
var last_token=$B.last(p.tokens)
if(last_token.type=="ENDMARKER"){var src=$B.file_cache[p.filename]
if(src){for(var token of $B.tokenizer(src)){if(token.type=="ENDMARKER"){break}
last_token=token}}}
get_last_token(p)
$B._PyPegen.raise_error(p,_b_.IndentationError,msg)},RAISE_SYNTAX_ERROR_KNOWN_LOCATION:function(p,a,err_msg,arg){if(arg !==undefined){err_msg=_b_.str.nb_remainder(err_msg,arg)}
helper_functions.RAISE_ERROR_KNOWN_LOCATION(p,_b_.SyntaxError,a.lineno,a.col_offset,a.end_lineno,a.end_col_offset,err_msg)},RAISE_SYNTAX_ERROR_KNOWN_RANGE:function(p,a,b,msg){var extra_args=arguments[4]
if(extra_args){msg=_b_.str.nb_remainder(msg,extra_args)}
helper_functions.RAISE_ERROR_KNOWN_LOCATION(p,_b_.SyntaxError,a.lineno,a.col_offset,b.end_lineno,b.end_col_offset,msg,extra_args)},RAISE_SYNTAX_ERROR_INVALID_TARGET:function(p,type,e){return helper_functions._RAISE_SYNTAX_ERROR_INVALID_TARGET(p,type,e)},_RAISE_SYNTAX_ERROR_INVALID_TARGET(p,type,e){var invalid_target=$B.helper_functions.CHECK_NULL_ALLOWED($B.ast.expr,$B._PyPegen.get_invalid_target(e,type))
if(invalid_target !=NULL){var msg;
if(type==$B.parser_constants.STAR_TARGETS ||
type==$B.parser_constants.FOR_TARGETS){msg="cannot assign to %s"}else{
msg="cannot delete %s"}
return helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(
p,invalid_target,msg,$B._PyPegen.get_expr_name(invalid_target)
)}
return NULL},RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN:function(p,msg){return helper_functions.RAISE_SYNTAX_ERROR(p,msg)},RAISE_SYNTAX_ERROR_STARTING_FROM:function(p,a,msg,...args){var last=p.tokens[p.tokens.length-1]
return helper_functions.RAISE_ERROR_KNOWN_LOCATION(p,_b_.SyntaxError,a.lineno,a.col_offset,last.end_lineno,last.end_col_offset-1,msg,...args)},asdl_seq_LEN:(t)=> t.length,asdl_seq_GET:(t,i)=> t[i]}
$B.helper_functions=helper_functions
function raise_error_known_location(type,filename,lineno,col_offset,end_lineno,end_col_offset,line,message){var exc=$B.EXC(type,message)
exc.filename=filename
exc.lineno=lineno
exc.offset=col_offset+1
exc.end_lineno=end_lineno
exc.end_offset=end_col_offset+1
exc.text=line
exc.args[1]=$B.fast_tuple([filename,exc.lineno,exc.offset,exc.text,exc.end_lineno,exc.end_offset])
exc.$frame_obj=$B.frame_obj
throw exc}
$B.raise_error_known_location=raise_error_known_location
function make_error_known_token(type,filename,token,message){var exc=$B.EXC(type,message)
exc.filename=filename
exc.lineno=token.lineno
exc.offset=token.col_offset+1
exc.end_lineno=token.end_lineno
exc.end_offset=token.end_col_offset+1
exc.text=token.line
exc.args[1]=$B.fast_tuple([filename,exc.lineno,exc.offset,exc.text,exc.end_lineno,exc.end_offset])
exc.$frame_obj=$B.frame_obj
return exc}
$B.make_error_known_token=make_error_known_token
function set_position_from_EXTRA(ast_obj,EXTRA){for(var key in EXTRA){ast_obj[key]=EXTRA[key]}}
var Parser=$B.Parser=function(src,filename,mode){
this._tokens=$B.tokenizer(src,filename,mode,this)
this.pos=0
this.tok={}
this.mark=0
this.fill=0
this.level=0
this.size=1
this.starting_lineno=0
this.starting_col_offset=0
this.last_stmt_location={}
this.tokens=[]
this.src=src
this.filename=filename
this.mode=mode
this.memo={}
this.arena={a_objects:[]}
if(filename){p.filename=filename}}
Parser.prototype.read_token=function(){while(true){var next=this._tokens[this.pos++]
if(next){var value=next
if(! value.parser_ignored){
if(value.$error_token){$B.raise_error_known_location(...value)}else if(value.$error_token_known_token){throw make_error_known_token(...value)}
this.tokens[this.tokens.length]=value
return value}}else{
throw Error('tokenizer exhausted')}}}})(__BRYTHON__);
;
"use strict";
(function($B){
var _b_=__BRYTHON__.builtins
const Load=new $B.ast.Load()
const NULL=undefined
const ENDMARKER=0,NAME=1,NUMBER=2,STRING=3
function strcmp(x,y){return x==y ? 0 :x < y ?-1 :1}
function strchr(s,char){return s.includes(char)}
function strlen(s){return s.length}
function strncmp(a,b){return a < b ?-1 :a > b ? 1 :0}
function PyOS_strtol(s,end,base){return parseFloat(s)}
function PyOS_strtoul(s,end,base){return parseFloat(s)}
function PyOS_string_to_double(s,x,y){return parseFloat(s)}
function PyFloat_FromDouble(x){return x}
const NSTATISTICS=2000,memo_statistics={},TYPE_IGNORE='TYPE_IGNORE',ERRORTOKEN='ERRORTOKEN',NEWLINE=$B.py_tokens.NEWLINE,DEDENT=$B.py_tokens.DEDENT,INDENT=$B.py_tokens.INDENT,Py_single_input='py_single_input',PyPARSE_ALLOW_INCOMPLETE_INPUT=0x0100
function PyUnicode_IS_ASCII(char){return char.codePointAt(0)< 128}
function set_position_from_token(ast_obj,token){for(var attr of['lineno','col_offset','end_lineno','end_col_offset']){ast_obj[attr]=token[attr]}}
$B._PyPegen.interactive_exit=function(p){if(p.errcode){(p.errcode)=E_EOF}
return NULL}
$B._PyPegen.byte_offset_to_character_offset_raw=function(str,col_offset){var len=str.length
if(col_offset > len+1){col_offset=len+1}
var text=PyUnicode_DecodeUTF8(str,col_offset,"replace")
if(!text){return-1}
return text.length}
$B._PyPegen.calculate_display_width=function(line,character_offset){var segment=line.substring(0,character_offset)
if(!segment){return-1}
if(PyUnicode_IS_ASCII(segment)){return character_offset}
var width_fn=_PyImport_GetModuleAttrString("unicodedata","east_asian_width")
if(!width_fn){return-1}
var width=0
var len=segment.length
for(let i=0;i < len;i++){var chr=segment.substring(i,i+1)
if(!chr){return-1}
var width_specifier=PyObject_CallOneArg(width_fn,chr)
if(!width_specifier){return-1}
if(width_specifier=="W" ||
width_specifier=="F"){width+=2}else{
width+=1}}
return width}
$B._PyPegen.byte_offset_to_character_offset=function(line,col_offset){var str=line
return _PyPegen_byte_offset_to_character_offset_raw(str,col_offset)}
$B._PyPegen.insert_memo=function(p,mark,type,node){
var m={type,node,mark:p.mark,next:p.tokens[mark].memo}
p.tokens[mark].memo=m
return 0}
$B._PyPegen.update_memo=function(p,mark,type,node){for(let m=p.tokens[mark].memo;m !=NULL;m=m.next){if(m.type==type){
m.node=node
m.mark=p.mark
return 0}}
return $B._PyPegen.insert_memo(p,mark,type,node)}
function growable_comment_array_init(arr,initial_size){arr.items=new Array(initial_size*arr.items.length)
arr.size=initial_size
arr.num_items=0
return arr.items !=NULL}
function growable_comment_array_add(arr,lineno,comment){return 1}
function growable_comment_array_deallocate(arr){}
function _get_keyword_or_name_type(p,new_token){return p.keywords[new_token.string]?? NAME}
function initialize_token(p,parser_token,new_token,token_type){parser_token.num_type=(token_type==NAME)
? _get_keyword_or_name_type(p,new_token)
:token_type
if(parser_token.num_type==-1){console.log('bizarre',new_token)
console.log('keywords',p.keywords)
alert()}
parser_token.metadata=NULL
if(new_token.metadata !=NULL){parser_token.metadata=new_token.metadata
new_token.metadata=NULL}
parser_token.level=new_token.level
parser_token.lineno=new_token.lineno
parser_token.col_offset=p.tok.lineno==p.starting_lineno
? p.starting_col_offset+new_token.col_offset
:new_token.col_offset
parser_token.end_lineno=new_token.end_lineno
parser_token.end_col_offset=p.tok.lineno==p.starting_lineno
? p.starting_col_offset+new_token.end_col_offset
:new_token.end_col_offset
p.arena.lineno=parser_token.lineno
p.fill+=1
if(token_type==ERRORTOKEN && p.tok.done==E_DECODE){return _Pypegen_raise_decode_error(p)}
return(token_type==ERRORTOKEN ? _Pypegen_tokenizer_error(p):0)}
function _PyToken_Init(token){token.metadata=NULL}
function _PyTokenizer_Get(tok,new_token){var token=tok.next().value
for(var key in token){new_token[key]=token[key]}
return token.num_type}
function get_next_token(p,new_token){var token=p.tokens[p.fill]?? p.read_token()
for(var key in token){new_token[key]=token[key]}
if(token.num_type==$B.py_tokens.ENDMARKER){
if(p.mode=='single'){var end_token=p.tokens[p.tokens.length-2]
if(end_token.num_type !=$B.py_tokens.NEWLINE){var newline=$B.clone(end_token)
newline.num_type=$B.py_tokens.NEWLINE
p.tokens.splice(p.tokens.length-1,0,newline)
token=newline}}}
return token.num_type}
$B._PyPegen.fill_token=function(p){var new_token={metadata:NULL}
var type=get_next_token(p,new_token)
while(type==TYPE_IGNORE){type=get_next_token(p,new_token)}
if(p.start_rule==Py_single_input && type==ENDMARKER && p.parsing_started){type=NEWLINE 
p.parsing_started=0
if(p.tok.indent && !(p.flags & PyPARSE_DONT_IMPLY_DEDENT)){p.tok.pendin=-p.tok.indent
p.tok.indent=0}}else{
p.parsing_started=1}
var t=p.tokens[p.fill]
return initialize_token(p,t,new_token,type)}
$B._PyPegen.clear_memo_statistics=function(){for(let i=0;i < NSTATISTICS;i++){memo_statistics[i]=0}}
$B._PyPegen.get_memo_statistics=function(){var ret=new Array(NSTATISTICS)
if(ret==NULL){return NULL}
for(let i=0;i < NSTATISTICS;i++){var value=PyLong_FromLong(memo_statistics[i])
if(value==NULL){return NULL}
if(PyList_SetItem(ret,i,value)< 0){Py_DECREF(ret)
return NULL}}
return ret}
$B._PyPegen.is_memoized=function(p,type,pres){if(p.mark==p.fill){if($B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return-1}}
var t=p.tokens[p.mark]
for(var m=t.memo;m !=NULL;m=m.next){if(m.type==type){p.mark=m.mark
pres.value=m.node
return 1}}
return 0}
$B._PyPegen.lookahead_with_name=function(positive,func,p){var mark=p.mark
var res=func(p)
p.mark=mark
return(res !=NULL)==positive}
$B._PyPegen.lookahead_with_string=function(positive,func,p,arg){var mark=p.mark
var res=func(p,arg)
p.mark=mark
return(res !=NULL)==positive}
$B._PyPegen.lookahead_with_int=function(positive,func,p,arg){var mark=p.mark
var res=func(p,arg)
p.mark=mark
return(res !=NULL)==positive}
$B._PyPegen.lookahead=function(positive,func,p){var mark=p.mark
var res=func(p)
p.mark=mark
return(res !=NULL)==positive}
$B._PyPegen.expect_token=function(p,type){if(p.mark==p.fill){if($B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}}
var t=p.tokens[p.mark]
if(t.num_type !=type){return NULL}
p.mark+=1
return t}
$B._PyPegen.expect_forced_result=function(p,result,expected){if(p.error_indicator==1){return NULL}
if(result==NULL){RAISE_SYNTAX_ERROR("expected (%s)",expected)
return NULL}
return result}
$B._PyPegen.expect_forced_token=function(p,type,expected){if(p.error_indicator==1){return NULL}
if(p.mark==p.fill){if($B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}}
var t=p.tokens[p.mark]
if(t.num_type !=type){$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,t,`expected '${expected}'`)
return NULL}
p.mark+=1
return t}
$B._PyPegen.expect_soft_keyword=function(p,keyword){if(p.mark==p.fill){if($B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}}
var t=p.tokens[p.mark]
if(t.num_type !=NAME){return NULL}
const s=t.string
if(!s){p.error_indicator=1
return NULL}
if(strcmp(s,keyword)!=0){return NULL}
return $B._PyPegen.name_token(p)}
$B._PyPegen.get_last_nonnwhitespace_token=function(p){var token=NULL
for(let m=p.mark-1;m >=0;m--){token=p.tokens[m]
if(token.num_type !=ENDMARKER &&(token.num_type < NEWLINE ||token.num_type > DEDENT)){break}}
return token}
$B._PyPegen.new_identifier=function(p,n){
return/^[\x00-\x7f]*$/.test(n)? n :n.normalize('NFKC')}
$B._PyPegen.name_from_token=function(p,t){if(t==NULL){return NULL}
var s=t.string
if(!s){p.error_indicator=1
return NULL}
var res=new $B.ast.Name($B._PyPegen.new_identifier(p,s),Load)
set_position_from_token(res,t)
return res}
$B._PyPegen.name_token=function(p){var t=$B._PyPegen.expect_token(p,NAME)
return $B._PyPegen.name_from_token(p,t)}
$B._PyPegen.string_token=function(p){return $B._PyPegen.expect_token(p,STRING)}
$B._PyPegen.soft_keyword_token=function(p){var t=$B._PyPegen.expect_token(p,NAME)
if(t==NULL){return NULL}
var the_token
var size
the_token=t.string
for(let keyword=p.soft_keywords;keyword !=NULL;keyword++){if(strncmp(keyword,the_token,size)==0){return $B._PyPegen.name_from_token(p,t)}}
return NULL}
function prepared_number_value(prepared){switch(prepared.type){case 'float':
return $B.fast_float(parseFloat(prepared.value))
case 'imaginary':
return $B.make_complex(0,prepared_number_value(prepared.value))
case 'int':
var res=parseInt(prepared.value[1],prepared.value[0])
if(! Number.isSafeInteger(res)){var base=prepared.value[0],num_str=prepared.value[1]
switch(base){case 8:
return BigInt('0x'+num_str)
case 10:
return BigInt(num_str)
case 16:
return BigInt('0x'+num_str)}}
return res}}
function parsenumber_raw(s){var prepared=$B.prepare_number(s)
return prepared_number_value(prepared)}
function parsenumber(s){var dup
var end
var res=NULL
if(strchr(s,'_')==NULL){return parsenumber_raw(s)}
dup=s.replace(/_/g,'')
res=parsenumber_raw(dup)
return res}
$B._PyPegen.number_token=function(p){var t=$B._PyPegen.expect_token(p,NUMBER)
if(t==NULL){return NULL}
var num_raw=t.string
if(num_raw==NULL){p.error_indicator=1
return NULL}
if(p.feature_version < 6 && strchr(num_raw,'_')!=NULL){p.error_indicator=1
return RAISE_SYNTAX_ERROR("Underscores in numeric literals are only supported "+
"in Python 3.6 and greater")}
var c=parsenumber(num_raw)
if(c==NULL){p.error_indicator=1
var tstate=_PyThreadState_GET()
if(tstate.current_exception !=NULL &&
Py_TYPE(tstate.current_exception)==PyExc_ValueError
){var exc=PyErr_GetRaisedException()
RAISE_ERROR_KNOWN_LOCATION(
p,PyExc_SyntaxError,t.lineno,-1 ,t.end_lineno,-1 ,"%S - Consider hexadecimal for huge integer literals "+
"to avoid decimal conversion limits.",exc)}
return NULL}
var res=new $B.ast.Constant(c,NULL)
set_position_from_token(res,t)
return res}
function bad_single_statement(p){var cur=p.tok.cur
var c=cur
var pos=0
for(;;){while(c==' ' ||c=='\t' ||c=='\n' ||c=='\f'){c=cur[pos++]}
if(!c){return 0}
if(c !='#'){return 1}
while(c && c !='\n'){c=cur[pos++]}}}
function compute_parser_flags(flags){var parser_flags=0
if(!flags){return 0}
if(flags.cf_flags & PyCF_DONT_IMPLY_DEDENT){parser_flags |=PyPARSE_DONT_IMPLY_DEDENT}
if(flags.cf_flags & PyCF_IGNORE_COOKIE){parser_flags |=PyPARSE_IGNORE_COOKIE}
if(flags.cf_flags & CO_FUTURE_BARRY_AS_BDFL){parser_flags |=PyPARSE_BARRY_AS_BDFL}
if(flags.cf_flags & PyCF_TYPE_COMMENTS){parser_flags |=PyPARSE_TYPE_COMMENTS}
if((flags.cf_flags & PyCF_ONLY_AST)&& flags.cf_feature_version < 7){parser_flags |=PyPARSE_ASYNC_HACKS}
if(flags.cf_flags & PyCF_ALLOW_INCOMPLETE_INPUT){parser_flags |=PyPARSE_ALLOW_INCOMPLETE_INPUT}
return parser_flags}
$B._PyPegen.Parser_New=function(tok,start_rule,flags,feature_version,errcode,source,arena){var p={}
tok.type_comments=(flags & PyPARSE_TYPE_COMMENTS)> 0
tok.async_hacks=(flags & PyPARSE_ASYNC_HACKS)> 0
p.tok=tok
p.keywords=NULL
p.n_keyword_lists=-1
p.soft_keywords=NULL
p.tokens=[]
p.tokens[0]=PyMem_Calloc(1,sizeof(Token))
p.mark=0
p.fill=0
p.size=1
p.errcode=errcode
p.arena=arena
p.start_rule=start_rule
p.parsing_started=0
p.normalize=NULL
p.error_indicator=0
p.starting_lineno=0
p.starting_col_offset=0
p.flags=flags
p.feature_version=feature_version
p.known_err_token=NULL
p.level=0
p.call_invalid_rules=0
p.debug=_Py_GetConfig().parser_debug
return p}
$B._PyPegen.Parser_Free=function(p){}
function reset_parser_state_for_error_pass(p){for(let i=0;i < p.fill;i++){p.tokens[i].memo=NULL}
p.mark=0
p.call_invalid_rules=1}
function _is_end_of_source(p){var err=p.tok.done
return p.tokens[p.tokens.length-1].type==$B.py_tokens.ENDMARKER}
function inside_fstring(p){var res=false
for(var token of p.tokens){if(token.type==$B.py_tokens.FSTRING_START){res=true}else if(token.type==$B.py_tokens.FSTRING_END){res=false}}
return res}
$B._PyPegen.tokenize_full_source_to_check_for_errors=function(p){var last_token=p.tokens[p.fill-1]
$B.tokenizer(p.src,p.filename,p.mode,p)
p.tokens=p._tokens
if(p.braces.length > 0){var brace=$B.last(p.braces),err_lineno,msg
if('([{'.includes(brace.char)){err_lineno=brace.line_num}else{
if(p.braces.length > 1){err_lineno=p.braces[p.braces.length-2].line_num}else{
err_lineno=brace.line_num}}
if(p.tokens.length==0 ||$B.last(p.tokens).lineno >=err_lineno){if('([{'.includes(brace.char)){msg=`'${brace.char}' was never closed`}else if(p.braces.length > 1){var closing=brace.char,opening=p.braces[p.braces.length-2].char
if(inside_fstring(p)){msg=`f-string: unmatched '${closing}'`}else{
msg=`closing parenthesis '${closing}' does not match `+
`opening parenthesis '${opening}'`}}else{
msg=`unmatched '${brace.char}'`}
$B.raise_error_known_location(_b_.SyntaxError,p.filename,brace.line_num,brace.pos-brace.line_start,brace.line_num,brace.pos-brace.line_start+1,brace.line,msg)}}}
$B._PyPegen.set_syntax_error=function(p,last_token){
if(p.fill==0){$B.helper_functions.RAISE_SYNTAX_ERROR(p,"error at start before reading any input")}
$B._PyPegen.tokenize_full_source_to_check_for_errors(p)
if(last_token.num_type==ERRORTOKEN && p.tok.done==E_EOF){if(p.tok.level){raise_unclosed_parentheses_error(p)}else{
$B.helper_functions.RAISE_SYNTAX_ERROR(p,"unexpected EOF while parsing")}
return}
if(last_token.num_type==INDENT ||last_token.num_type==DEDENT){$B.helper_functions.RAISE_INDENTATION_ERROR(p,last_token.num_type==INDENT ? "unexpected indent" :"unexpected unindent")
return}
$B._PyPegen.tokenize_full_source_to_check_for_errors(p)
return $B.make_error_known_token(_b_.SyntaxError,p.filename,last_token,"invalid syntax")}
$B._PyPegen.set_syntax_error_metadata=function(p,exc){if(! exc ||! $B.is_exc(exc,[_b_.SyntaxError])){return}
var source=NULL
if(p.src !=NULL){source=p.src}
if(!source && p.tok.fp_interactive && p.tok.interactive_src_start){source=p.tok.interactive_src_start}
var the_source=NULL
if(source){the_source=source}
if(!the_source){the_source=_b_.None}
var metadata=[exc.lineno,exc.offset,the_source 
]
if(!metadata){return}
exc._metadata=metadata}
$B._PyPegen.run_parser=function(p){var res=$B._PyPegen.parse(p)
$B.python_keywords=p.keywords
if(res==NULL){if((p.flags & $B.PyCF_ALLOW_INCOMPLETE_INPUT)&& _is_end_of_source(p)){return $B.helper_functions.RAISE_ERROR(p,_b_._IncompleteInputError,"incomplete input")}
var last_token=p.tokens[p.fill-1]
reset_parser_state_for_error_pass(p)
try{
$B._PyPegen.parse(p)}catch(err){last_token=p.tokens[p.fill-1]
$B._PyPegen.tokenize_full_source_to_check_for_errors(p)
throw err}
var exc=$B._PyPegen.set_syntax_error(p,last_token)
if($B.is_exc(exc,[_b_.SyntaxError])){$B._PyPegen.set_syntax_error_metadata(p,exc)}
throw exc}
if(p.start_rule==Py_single_input && bad_single_statement(p)){p.tok.done=E_BADSINGLE 
return RAISE_SYNTAX_ERROR("multiple statements found while compiling a single statement")}
return res}
$B._PyPegen.run_parser_from_file_pointer=function(fp,start_rule,filename_ob,enc,ps1,ps2,flags,errcode,arena){var tok=_PyTokenizer_FromFile(fp,enc,ps1,ps2)
if(tok==NULL){if(PyErr_Occurred()){_PyPegen_raise_tokenizer_init_error(filename_ob)
return NULL}
return NULL}
if(!tok.fp ||ps1 !=NULL ||ps2 !=NULL ||
PyUnicode_CompareWithASCIIString(filename_ob,"<stdin>")==0){tok.fp_interactive=1}
tok.filename=Py_NewRef(filename_ob)
var result=NULL
var parser_flags=compute_parser_flags(flags)
var p=$B._PyPegen.Parser_New(tok,start_rule,parser_flags,PY_MINOR_VERSION,errcode,NULL,arena)
if(p==NULL){return error()}
result=_PyPegen_run_parser(p)
_PyPegen_Parser_Free(p)
function error(){_PyTokenizer_Free(tok)
return result}}
$B._PyPegen.run_parser_from_string=function(str,start_rule,filename_ob,flags,arena){var exec_input=start_rule==Py_file_input
var tok
if(flags !=NULL && flags.cf_flags & PyCF_IGNORE_COOKIE){tok=_PyTokenizer_FromUTF8(str,exec_input,0)}else{
tok=_PyTokenizer_FromString(str,exec_input,0)}
if(tok==NULL){if(PyErr_Occurred()){_PyPegen_raise_tokenizer_init_error(filename_ob)}
return NULL}
tok.filename=Py_NewRef(filename_ob)
var result=NULL
var parser_flags=compute_parser_flags(flags)
var feature_version=flags &&(flags.cf_flags & PyCF_ONLY_AST)?
flags.cf_feature_version :PY_MINOR_VERSION
var p=$B._PyPegen.Parser_New(tok,start_rule,parser_flags,feature_version,NULL,str,arena)
if(p==NULL){return error()}
result=_PyPegen_run_parser(p)
_PyPegen_Parser_Free(p)
function error(){return result}}
$B.PyPegen={first_item:function(a,type){return a[0]},last_item:function(a,ptype){return a[a.length-1]}}})(__BRYTHON__);
;

(function($B){"use strict";
function fprintf(dest,format){var args=Array.from(arguments).slice(2)
for(var arg of args){format=format.replace(/%\*?[a-z]/,arg)}
return format}
const stderr=null
function D(x){console.log(x)}
function UNUSED(){}
const MAXSTACK=6000,NULL=undefined
function NEW_TYPE_COMMENT(){}
var $B=__BRYTHON__
const Store=new $B.ast.Store(),Load=new $B.ast.Load
const EXTRA={}
const ENDMARKER=0,NAME=1,NUMBER=2,STRING=3,NEWLINE=4,INDENT=5,DEDENT=6,LPAR=7,RPAR=8,LSQB=9,RSQB=10,COLON=11,COMMA=12,SEMI=13,PLUS=14,MINUS=15,STAR=16,SLASH=17,VBAR=18,AMPER=19,LESS=20,GREATER=21,EQUAL=22,DOT=23,PERCENT=24,LBRACE=25,RBRACE=26,EQEQUAL=27,NOTEQUAL=28,LESSEQUAL=29,GREATEREQUAL=30,TILDE=31,CIRCUMFLEX=32,LEFTSHIFT=33,RIGHTSHIFT=34,DOUBLESTAR=35,PLUSEQUAL=36,MINEQUAL=37,STAREQUAL=38,SLASHEQUAL=39,PERCENTEQUAL=40,AMPEREQUAL=41,VBAREQUAL=42,CIRCUMFLEXEQUAL=43,LEFTSHIFTEQUAL=44,RIGHTSHIFTEQUAL=45,DOUBLESTAREQUAL=46,DOUBLESLASH=47,DOUBLESLASHEQUAL=48,AT=49,ATEQUAL=50,RARROW=51,ELLIPSIS=52,COLONEQUAL=53,EXCLAMATION=54,OP=55,TYPE_IGNORE=56,TYPE_COMMENT=57,SOFT_KEYWORD=58,FSTRING_START=59,FSTRING_MIDDLE=60,FSTRING_END=61,TSTRING_START=62,TSTRING_MIDDLE=63,TSTRING_END=64,COMMENT=65,NL=66,ERRORTOKEN=67,ENCODING=68
const n_keyword_lists=9
const _reserved_keywords={if:682,as:680,in:695,or:588,is:596,del:625,def:699,for:694,try:656,and:589,not:703,from:633,pass:526,with:647,elif:687,else:686,None:623,True:622,raise:525,yield:587,break:527,async:698,class:701,while:689,False:624,await:597,return:522,import:634,assert:532,global:529,except:677,lambda:621,finally:673,continue:528,nonlocal:530,}
const reserved_keywords=Object.create(null)
for(var item of Object.entries(_reserved_keywords)){reserved_keywords[item[0]]=item[1]}
const soft_keywords=["_","case","match","type",NULL,];
const file_type=1000,interactive_type=1001,eval_type=1002,func_type_type=1003,statements_type=1004,statement_type=1005,single_compound_stmt_type=1006,statement_newline_type=1007,simple_stmts_type=1008,simple_stmt_type=1009,compound_stmt_type=1010,assignment_type=1011,annotated_rhs_type=1012,augassign_type=1013,return_stmt_type=1014,raise_stmt_type=1015,pass_stmt_type=1016,break_stmt_type=1017,continue_stmt_type=1018,global_stmt_type=1019,nonlocal_stmt_type=1020,del_stmt_type=1021,yield_stmt_type=1022,assert_stmt_type=1023,import_stmt_type=1024,import_name_type=1025,import_from_type=1026,import_from_targets_type=1027,import_from_as_names_type=1028,import_from_as_name_type=1029,dotted_as_names_type=1030,dotted_as_name_type=1031,dotted_name_type=1032,block_type=1033,decorators_type=1034,class_def_type=1035,class_def_raw_type=1036,function_def_type=1037,function_def_raw_type=1038,params_type=1039,parameters_type=1040,slash_no_default_type=1041,slash_with_default_type=1042,star_etc_type=1043,kwds_type=1044,param_no_default_type=1045,param_no_default_star_annotation_type=1046,param_with_default_type=1047,param_maybe_default_type=1048,param_type=1049,param_star_annotation_type=1050,annotation_type=1051,star_annotation_type=1052,default_type=1053,if_stmt_type=1054,elif_stmt_type=1055,else_block_type=1056,while_stmt_type=1057,for_stmt_type=1058,with_stmt_type=1059,with_item_type=1060,try_stmt_type=1061,except_block_type=1062,except_star_block_type=1063,finally_block_type=1064,match_stmt_type=1065,subject_expr_type=1066,case_block_type=1067,guard_type=1068,patterns_type=1069,pattern_type=1070,as_pattern_type=1071,or_pattern_type=1072,closed_pattern_type=1073,literal_pattern_type=1074,literal_expr_type=1075,complex_number_type=1076,signed_number_type=1077,signed_real_number_type=1078,real_number_type=1079,imaginary_number_type=1080,capture_pattern_type=1081,pattern_capture_target_type=1082,wildcard_pattern_type=1083,value_pattern_type=1084,attr_type=1085,name_or_attr_type=1086,group_pattern_type=1087,sequence_pattern_type=1088,open_sequence_pattern_type=1089,maybe_sequence_pattern_type=1090,maybe_star_pattern_type=1091,star_pattern_type=1092,mapping_pattern_type=1093,items_pattern_type=1094,key_value_pattern_type=1095,double_star_pattern_type=1096,class_pattern_type=1097,positional_patterns_type=1098,keyword_patterns_type=1099,keyword_pattern_type=1100,type_alias_type=1101,type_params_type=1102,type_param_seq_type=1103,type_param_type=1104,type_param_bound_type=1105,type_param_default_type=1106,type_param_starred_default_type=1107,expressions_type=1108,expression_type=1109,yield_expr_type=1110,star_expressions_type=1111,star_expression_type=1112,star_named_expressions_type=1113,star_named_expression_type=1114,assignment_expression_type=1115,named_expression_type=1116,disjunction_type=1117,conjunction_type=1118,inversion_type=1119,comparison_type=1120,compare_op_bitwise_or_pair_type=1121,eq_bitwise_or_type=1122,noteq_bitwise_or_type=1123,lte_bitwise_or_type=1124,lt_bitwise_or_type=1125,gte_bitwise_or_type=1126,gt_bitwise_or_type=1127,notin_bitwise_or_type=1128,in_bitwise_or_type=1129,isnot_bitwise_or_type=1130,is_bitwise_or_type=1131,bitwise_or_type=1132,bitwise_xor_type=1133,bitwise_and_type=1134,shift_expr_type=1135,sum_type=1136,term_type=1137,factor_type=1138,power_type=1139,await_primary_type=1140,primary_type=1141,slices_type=1142,slice_type=1143,atom_type=1144,group_type=1145,lambdef_type=1146,lambda_params_type=1147,lambda_parameters_type=1148,lambda_slash_no_default_type=1149,lambda_slash_with_default_type=1150,lambda_star_etc_type=1151,lambda_kwds_type=1152,lambda_param_no_default_type=1153,lambda_param_with_default_type=1154,lambda_param_maybe_default_type=1155,lambda_param_type=1156,fstring_middle_type=1157,fstring_replacement_field_type=1158,fstring_conversion_type=1159,fstring_full_format_spec_type=1160,fstring_format_spec_type=1161,fstring_type=1162,tstring_format_spec_replacement_field_type=1163,tstring_format_spec_type=1164,tstring_full_format_spec_type=1165,tstring_replacement_field_type=1166,tstring_middle_type=1167,tstring_type=1168,string_type=1169,strings_type=1170,list_type=1171,tuple_type=1172,set_type=1173,dict_type=1174,double_starred_kvpairs_type=1175,double_starred_kvpair_type=1176,kvpair_type=1177,for_if_clauses_type=1178,for_if_clause_type=1179,listcomp_type=1180,setcomp_type=1181,genexp_type=1182,dictcomp_type=1183,arguments_type=1184,args_type=1185,kwargs_type=1186,starred_expression_type=1187,kwarg_or_starred_type=1188,kwarg_or_double_starred_type=1189,star_targets_type=1190,star_targets_list_seq_type=1191,star_targets_tuple_seq_type=1192,star_target_type=1193,target_with_star_atom_type=1194,star_atom_type=1195,single_target_type=1196,single_subscript_attribute_target_type=1197,t_primary_type=1198,t_lookahead_type=1199,del_targets_type=1200,del_target_type=1201,del_t_atom_type=1202,type_expressions_type=1203,func_type_comment_type=1204,invalid_arguments_type=1205,invalid_kwarg_type=1206,expression_without_invalid_type=1207,invalid_legacy_expression_type=1208,invalid_type_param_type=1209,invalid_expression_type=1210,invalid_named_expression_type=1211,invalid_assignment_type=1212,invalid_ann_assign_target_type=1213,invalid_del_stmt_type=1214,invalid_block_type=1215,invalid_comprehension_type=1216,invalid_dict_comprehension_type=1217,invalid_parameters_type=1218,invalid_default_type=1219,invalid_star_etc_type=1220,invalid_kwds_type=1221,invalid_parameters_helper_type=1222,invalid_lambda_parameters_type=1223,invalid_lambda_parameters_helper_type=1224,invalid_lambda_star_etc_type=1225,invalid_lambda_kwds_type=1226,invalid_double_type_comments_type=1227,invalid_with_item_type=1228,invalid_for_if_clause_type=1229,invalid_for_target_type=1230,invalid_group_type=1231,invalid_import_type=1232,invalid_dotted_as_name_type=1233,invalid_import_from_as_name_type=1234,invalid_import_from_targets_type=1235,invalid_with_stmt_type=1236,invalid_with_stmt_indent_type=1237,invalid_try_stmt_type=1238,invalid_except_stmt_type=1239,invalid_except_star_stmt_type=1240,invalid_finally_stmt_type=1241,invalid_except_stmt_indent_type=1242,invalid_except_star_stmt_indent_type=1243,invalid_match_stmt_type=1244,invalid_case_block_type=1245,invalid_as_pattern_type=1246,invalid_class_pattern_type=1247,invalid_class_argument_pattern_type=1248,invalid_if_stmt_type=1249,invalid_elif_stmt_type=1250,invalid_else_stmt_type=1251,invalid_while_stmt_type=1252,invalid_for_stmt_type=1253,invalid_def_raw_type=1254,invalid_class_def_raw_type=1255,invalid_double_starred_kvpairs_type=1256,invalid_kvpair_type=1257,invalid_starred_expression_unpacking_type=1258,invalid_starred_expression_type=1259,invalid_fstring_replacement_field_type=1260,invalid_fstring_conversion_character_type=1261,invalid_tstring_replacement_field_type=1262,invalid_tstring_conversion_character_type=1263,invalid_string_tstring_concat_type=1264,invalid_arithmetic_type=1265,invalid_factor_type=1266,invalid_type_params_type=1267,_loop0_1_type=1268,_loop0_2_type=1269,_loop1_3_type=1270,_loop0_5_type=1271,_gather_4_type=1272,_tmp_6_type=1273,_tmp_7_type=1274,_tmp_8_type=1275,_tmp_9_type=1276,_tmp_10_type=1277,_tmp_11_type=1278,_tmp_12_type=1279,_tmp_13_type=1280,_loop1_14_type=1281,_tmp_15_type=1282,_loop0_17_type=1283,_gather_16_type=1284,_loop0_19_type=1285,_gather_18_type=1286,_tmp_20_type=1287,_tmp_21_type=1288,_loop0_22_type=1289,_loop1_23_type=1290,_loop0_25_type=1291,_gather_24_type=1292,_tmp_26_type=1293,_loop0_28_type=1294,_gather_27_type=1295,_tmp_29_type=1296,_loop1_30_type=1297,_tmp_31_type=1298,_tmp_32_type=1299,_tmp_33_type=1300,_loop0_34_type=1301,_loop0_35_type=1302,_loop0_36_type=1303,_loop1_37_type=1304,_loop0_38_type=1305,_loop1_39_type=1306,_loop1_40_type=1307,_loop1_41_type=1308,_loop0_42_type=1309,_loop1_43_type=1310,_loop0_44_type=1311,_loop1_45_type=1312,_loop0_46_type=1313,_loop0_47_type=1314,_loop1_48_type=1315,_loop0_50_type=1316,_gather_49_type=1317,_loop0_52_type=1318,_gather_51_type=1319,_loop0_54_type=1320,_gather_53_type=1321,_loop0_56_type=1322,_gather_55_type=1323,_tmp_57_type=1324,_loop1_58_type=1325,_loop1_59_type=1326,_loop1_60_type=1327,_loop0_62_type=1328,_gather_61_type=1329,_tmp_63_type=1330,_tmp_64_type=1331,_tmp_65_type=1332,_tmp_66_type=1333,_tmp_67_type=1334,_loop0_69_type=1335,_gather_68_type=1336,_loop0_71_type=1337,_gather_70_type=1338,_tmp_72_type=1339,_loop0_74_type=1340,_gather_73_type=1341,_loop0_76_type=1342,_gather_75_type=1343,_loop0_78_type=1344,_gather_77_type=1345,_loop1_79_type=1346,_loop1_80_type=1347,_loop0_82_type=1348,_gather_81_type=1349,_loop1_83_type=1350,_loop1_84_type=1351,_loop1_85_type=1352,_tmp_86_type=1353,_loop0_88_type=1354,_gather_87_type=1355,_tmp_89_type=1356,_tmp_90_type=1357,_tmp_91_type=1358,_tmp_92_type=1359,_tmp_93_type=1360,_tmp_94_type=1361,_loop0_95_type=1362,_loop0_96_type=1363,_loop0_97_type=1364,_loop1_98_type=1365,_loop0_99_type=1366,_loop1_100_type=1367,_loop1_101_type=1368,_loop1_102_type=1369,_loop0_103_type=1370,_loop1_104_type=1371,_loop0_105_type=1372,_loop1_106_type=1373,_loop0_107_type=1374,_loop1_108_type=1375,_loop0_109_type=1376,_loop0_110_type=1377,_loop0_111_type=1378,_loop0_112_type=1379,_loop1_113_type=1380,_loop1_114_type=1381,_tmp_115_type=1382,_loop0_117_type=1383,_gather_116_type=1384,_loop1_118_type=1385,_loop0_119_type=1386,_loop0_120_type=1387,_tmp_121_type=1388,_loop0_123_type=1389,_gather_122_type=1390,_tmp_124_type=1391,_loop0_126_type=1392,_gather_125_type=1393,_loop0_128_type=1394,_gather_127_type=1395,_loop0_130_type=1396,_gather_129_type=1397,_loop0_132_type=1398,_gather_131_type=1399,_loop0_133_type=1400,_loop0_135_type=1401,_gather_134_type=1402,_loop1_136_type=1403,_tmp_137_type=1404,_loop0_139_type=1405,_gather_138_type=1406,_loop0_141_type=1407,_gather_140_type=1408,_loop0_143_type=1409,_gather_142_type=1410,_loop0_145_type=1411,_gather_144_type=1412,_loop0_147_type=1413,_gather_146_type=1414,_tmp_148_type=1415,_tmp_149_type=1416,_loop0_151_type=1417,_gather_150_type=1418,_tmp_152_type=1419,_tmp_153_type=1420,_tmp_154_type=1421,_tmp_155_type=1422,_tmp_156_type=1423,_loop1_157_type=1424,_tmp_158_type=1425,_tmp_159_type=1426,_tmp_160_type=1427,_tmp_161_type=1428,_tmp_162_type=1429,_tmp_163_type=1430,_loop0_164_type=1431,_loop0_165_type=1432,_loop0_166_type=1433,_tmp_167_type=1434,_tmp_168_type=1435,_tmp_169_type=1436,_tmp_170_type=1437,_loop0_171_type=1438,_loop0_172_type=1439,_loop0_173_type=1440,_loop1_174_type=1441,_tmp_175_type=1442,_loop0_176_type=1443,_tmp_177_type=1444,_loop0_178_type=1445,_loop1_179_type=1446,_tmp_180_type=1447,_tmp_181_type=1448,_tmp_182_type=1449,_loop0_183_type=1450,_tmp_184_type=1451,_tmp_185_type=1452,_loop1_186_type=1453,_tmp_187_type=1454,_loop0_188_type=1455,_loop0_189_type=1456,_loop0_190_type=1457,_loop0_192_type=1458,_gather_191_type=1459,_tmp_193_type=1460,_loop0_194_type=1461,_tmp_195_type=1462,_loop0_196_type=1463,_loop1_197_type=1464,_loop1_198_type=1465,_tmp_199_type=1466,_tmp_200_type=1467,_loop0_201_type=1468,_tmp_202_type=1469,_tmp_203_type=1470,_tmp_204_type=1471,_tmp_205_type=1472,_loop0_207_type=1473,_gather_206_type=1474,_tmp_208_type=1475,_tmp_209_type=1476,_loop0_211_type=1477,_gather_210_type=1478,_loop0_213_type=1479,_gather_212_type=1480,_loop0_215_type=1481,_gather_214_type=1482,_loop0_217_type=1483,_gather_216_type=1484,_tmp_218_type=1485,_loop0_219_type=1486,_loop1_220_type=1487,_tmp_221_type=1488,_loop0_222_type=1489,_loop1_223_type=1490,_tmp_224_type=1491,_tmp_225_type=1492,_tmp_226_type=1493,_tmp_227_type=1494,_tmp_228_type=1495,_tmp_229_type=1496,_tmp_230_type=1497,_tmp_231_type=1498,_tmp_232_type=1499,_tmp_233_type=1500,_tmp_234_type=1501,_loop0_236_type=1502,_gather_235_type=1503,_tmp_237_type=1504,_tmp_238_type=1505,_tmp_239_type=1506,_tmp_240_type=1507,_tmp_241_type=1508,_tmp_242_type=1509,_tmp_243_type=1510,_loop0_244_type=1511,_tmp_245_type=1512,_tmp_246_type=1513,_tmp_247_type=1514,_tmp_248_type=1515,_tmp_249_type=1516,_tmp_250_type=1517,_tmp_251_type=1518,_loop0_252_type=1519,_tmp_253_type=1520,_tmp_254_type=1521,_loop1_255_type=1522,_loop1_256_type=1523,_tmp_257_type=1524,_tmp_258_type=1525,_tmp_259_type=1526,_tmp_260_type=1527,_tmp_261_type=1528,_tmp_262_type=1529,_tmp_263_type=1530,_tmp_264_type=1531,_tmp_265_type=1532,_tmp_266_type=1533,_tmp_267_type=1534,_tmp_268_type=1535,_tmp_269_type=1536,_tmp_270_type=1537,_tmp_271_type=1538,_tmp_272_type=1539,_tmp_273_type=1540,_tmp_274_type=1541,_tmp_275_type=1542,_tmp_276_type=1543,_tmp_277_type=1544,_tmp_278_type=1545,_tmp_279_type=1546,_tmp_280_type=1547,_tmp_281_type=1548,_loop0_282_type=1549,_tmp_283_type=1550,_tmp_284_type=1551,_tmp_285_type=1552,_tmp_286_type=1553,_tmp_287_type=1554,_tmp_288_type=1555,_tmp_289_type=1556,_tmp_290_type=1557,_tmp_291_type=1558,_loop0_293_type=1559,_gather_292_type=1560,_tmp_294_type=1561,_tmp_295_type=1562,_tmp_296_type=1563,_tmp_297_type=1564,_tmp_298_type=1565,_tmp_299_type=1566,_tmp_300_type=1567
function file_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var endmarker_var
if(
(a=statements_rule(p),!p.error_indicator)
&&
(endmarker_var=$B._PyPegen.expect_token(p,ENDMARKER))
)
{_res=$B._PyPegen.make_module(p,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function interactive_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=statement_newline_rule(p))
)
{_res=new $B._PyAST.Interactive(a,p.arena)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function eval_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _loop0_1_var
var a
var endmarker_var
if(
(a=expressions_rule(p))
&&
(_loop0_1_var=_loop0_1_rule(p))
&&
(endmarker_var=$B._PyPegen.expect_token(p,ENDMARKER))
)
{_res=new $B._PyAST.Expression(a,p.arena)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function func_type_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var _loop0_2_var
var a
var b
var endmarker_var
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=type_expressions_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_literal_2=$B._PyPegen.expect_token(p,51))
&&
(b=expression_rule(p))
&&
(_loop0_2_var=_loop0_2_rule(p))
&&
(endmarker_var=$B._PyPegen.expect_token(p,ENDMARKER))
)
{_res=new $B._PyAST.FunctionType(a,b,p.arena)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function statements_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=_loop1_3_rule(p))
)
{_res=$B._PyPegen.seq_flatten(p,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function statement_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=compound_stmt_rule(p))
)
{_res=$B._PyPegen.register_stmts(p,$B._PyPegen.singleton_seq(p,a ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=simple_stmts_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function single_compound_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=compound_stmt_rule(p))
)
{_res=$B._PyPegen.register_stmts(p,$B._PyPegen.singleton_seq(p,a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function statement_newline_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var newline_var
if(
(a=single_compound_stmt_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var simple_stmts_var
if(
(simple_stmts_var=simple_stmts_rule(p))
)
{_res=simple_stmts_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.singleton_seq(p,$B.helper_functions.CHECK($B.ast.stmt,new $B._PyAST.Pass(EXTRA )))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var endmarker_var
if(
(endmarker_var=$B._PyPegen.expect_token(p,ENDMARKER))
)
{_res=$B._PyPegen.interactive_exit(p)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function simple_stmts_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var newline_var
if(
(a=simple_stmt_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,13)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var newline_var
if(
(a=_gather_4_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,13),!p.error_indicator)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function simple_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,simple_stmt_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var assignment_var
if(
(assignment_var=assignment_rule(p))
)
{_res=assignment_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var type_alias_var
if(
$B._PyPegen.lookahead_with_string(1,$B._PyPegen.expect_soft_keyword,p,"type")
&&
(type_alias_var=type_alias_rule(p))
)
{_res=type_alias_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var e
if(
(e=star_expressions_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Expr(e,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var return_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,522)
&&
(return_stmt_var=return_stmt_rule(p))
)
{_res=return_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var import_stmt_var
if(
$B._PyPegen.lookahead(1,_tmp_6_rule,p)
&&
(import_stmt_var=import_stmt_rule(p))
)
{_res=import_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var raise_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,525)
&&
(raise_stmt_var=raise_stmt_rule(p))
)
{_res=raise_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var pass_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,526)
&&
(pass_stmt_var=pass_stmt_rule(p))
)
{_res=pass_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var del_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,625)
&&
(del_stmt_var=del_stmt_rule(p))
)
{_res=del_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var yield_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,587)
&&
(yield_stmt_var=yield_stmt_rule(p))
)
{_res=yield_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var assert_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,532)
&&
(assert_stmt_var=assert_stmt_rule(p))
)
{_res=assert_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var break_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,527)
&&
(break_stmt_var=break_stmt_rule(p))
)
{_res=break_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var continue_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,528)
&&
(continue_stmt_var=continue_stmt_rule(p))
)
{_res=continue_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var global_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,529)
&&
(global_stmt_var=global_stmt_rule(p))
)
{_res=global_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var nonlocal_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,530)
&&
(nonlocal_stmt_var=nonlocal_stmt_rule(p))
)
{_res=nonlocal_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,simple_stmt_type,_res)
return _res}
function compound_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var function_def_var
if(
$B._PyPegen.lookahead(1,_tmp_7_rule,p)
&&
(function_def_var=function_def_rule(p))
)
{_res=function_def_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var if_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,682)
&&
(if_stmt_var=if_stmt_rule(p))
)
{_res=if_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var class_def_var
if(
$B._PyPegen.lookahead(1,_tmp_8_rule,p)
&&
(class_def_var=class_def_rule(p))
)
{_res=class_def_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var with_stmt_var
if(
$B._PyPegen.lookahead(1,_tmp_9_rule,p)
&&
(with_stmt_var=with_stmt_rule(p))
)
{_res=with_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var for_stmt_var
if(
$B._PyPegen.lookahead(1,_tmp_10_rule,p)
&&
(for_stmt_var=for_stmt_rule(p))
)
{_res=for_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var try_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,656)
&&
(try_stmt_var=try_stmt_rule(p))
)
{_res=try_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var while_stmt_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,689)
&&
(while_stmt_var=while_stmt_rule(p))
)
{_res=while_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var match_stmt_var
if(
(match_stmt_var=match_stmt_rule(p))
)
{_res=match_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function assignment_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(a=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=expression_rule(p))
&&
(c=_tmp_11_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,6,"Variable annotation syntax is",new $B._PyAST.AnnAssign($B.helper_functions.CHECK($B.ast.expr,$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store )),b,c,1,EXTRA ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(a=_tmp_12_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=expression_rule(p))
&&
(c=_tmp_13_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,6,"Variable annotations syntax is",new $B._PyAST.AnnAssign(a,b,c,0,EXTRA ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var tc
if(
(a=_loop1_14_rule(p))
&&
(b=annotated_rhs_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,22)
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Assign(a,b,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _cut_var=0
var a
var b
var c
if(
(a=single_target_rule(p))
&&
(b=augassign_rule(p))
&&
(_cut_var=1)
&&
(c=annotated_rhs_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.AugAssign(a,b.kind,c,EXTRA)
break}
p.mark=_mark
if(_cut_var){return NULL}}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_assignment_var
if(
(invalid_assignment_var=invalid_assignment_rule(p))
)
{_res=invalid_assignment_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function annotated_rhs_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var yield_expr_var
if(
(yield_expr_var=yield_expr_rule(p))
)
{_res=yield_expr_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var star_expressions_var
if(
(star_expressions_var=star_expressions_rule(p))
)
{_res=star_expressions_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function augassign_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,36))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Add())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,37))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Sub())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,38))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Mult())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,50))
)
{_res=$B.helper_functions.CHECK_VERSION($B.parser_constants.AugOperator,5,"The '@' operator is",$B._PyPegen.augoperator(p,new $B.ast.MatMult()))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,39))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Div())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,40))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Mod())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,41))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.BitAnd())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,42))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.BitOr())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,43))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.BitXor())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,44))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.LShift())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,45))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.RShift())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,46))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.Pow())
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,48))
)
{_res=$B._PyPegen.augoperator(p,new $B.ast.FloorDiv())
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function return_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,522))
&&
(a=star_expressions_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Return(a,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function raise_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
var b
if(
(_keyword=$B._PyPegen.expect_token(p,525))
&&
(a=expression_rule(p))
&&
(b=_tmp_15_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Raise(a,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,525))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Raise($B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function pass_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,526))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Pass(EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function break_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,527))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Break(EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function continue_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,528))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Continue(EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function global_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,529))
&&
(a=_gather_16_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Global($B.helper_functions.CHECK($B.parser_constants.asdl_identifier_seq,$B._PyPegen.map_names_to_ids(p,a )),EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function nonlocal_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,530))
&&
(a=_gather_18_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Nonlocal($B.helper_functions.CHECK($B.parser_constants.asdl_identifier_seq,$B._PyPegen.map_names_to_ids(p,a )),EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function del_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,625))
&&
(a=del_targets_rule(p))
&&
$B._PyPegen.lookahead(1,_tmp_20_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Delete(a,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_del_stmt_var
if(
(invalid_del_stmt_var=invalid_del_stmt_rule(p))
)
{_res=invalid_del_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function yield_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var y
if(
(y=yield_expr_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Expr(y,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function assert_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
var b
if(
(_keyword=$B._PyPegen.expect_token(p,532))
&&
(a=expression_rule(p))
&&
(b=_tmp_21_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Assert(a,b,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_import_var
if(
(invalid_import_var=invalid_import_rule(p))
)
{_res=invalid_import_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var import_name_var
if(
(import_name_var=import_name_rule(p))
)
{_res=import_name_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var import_from_var
if(
(import_from_var=import_from_rule(p))
)
{_res=import_from_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_name_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,634))
&&
(a=dotted_as_names_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Import(a,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_from_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,633))
&&
(a=_loop0_22_rule(p))
&&
(b=dotted_name_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,634))
&&
(c=import_from_targets_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.checked_future_import(p,b. id,c,$B._PyPegen.seq_count_dots(a ),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
var b
if(
(_keyword=$B._PyPegen.expect_token(p,633))
&&
(a=_loop1_23_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,634))
&&
(b=import_from_targets_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ImportFrom($B.parser_constants.NULL,b,$B._PyPegen.seq_count_dots(a ),EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_from_targets_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=import_from_as_names_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var import_from_as_names_var
if(
(import_from_as_names_var=import_from_as_names_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,12)
)
{_res=import_from_as_names_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,16))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.singleton_seq(p,$B.helper_functions.CHECK($B.ast.alias,$B._PyPegen.alias_for_star(p,EXTRA )))
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_import_from_targets_var
if(
(invalid_import_from_targets_var=invalid_import_from_targets_rule(p))
)
{_res=invalid_import_from_targets_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_from_as_names_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=_gather_24_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function import_from_as_name_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_import_from_as_name_var
if(
(invalid_import_from_as_name_var=invalid_import_from_as_name_rule(p))
)
{_res=invalid_import_from_as_name_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(b=_tmp_26_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.alias(a. id,(b )?(b ). id :$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function dotted_as_names_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=_gather_27_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function dotted_as_name_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_dotted_as_name_var
if(
(invalid_dotted_as_name_var=invalid_dotted_as_name_rule(p))
)
{_res=invalid_dotted_as_name_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=dotted_name_rule(p))
&&
(b=_tmp_29_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.alias(a. id,(b )?(b ). id :$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function dotted_name_raw(){}
function dotted_name_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,dotted_name_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_0=$B._PyPegen.update_memo(p,_mark,dotted_name_type,_res)
if(tmpvar_0){return _res}
p.mark=_mark
var _raw=dotted_name_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function dotted_name_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=dotted_name_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.join_names_with_dot(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
)
{_res=name_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,block_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var dedent_var
var indent_var
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
(indent_var=$B._PyPegen.expect_token(p,INDENT))
&&
(a=statements_rule(p))
&&
(dedent_var=$B._PyPegen.expect_token(p,DEDENT))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var simple_stmts_var
if(
(simple_stmts_var=simple_stmts_rule(p))
)
{_res=simple_stmts_var
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_block_var
if(
(invalid_block_var=invalid_block_rule(p))
)
{_res=invalid_block_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,block_type,_res)
return _res}
function decorators_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=_loop1_30_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function class_def_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=decorators_rule(p))
&&
(b=class_def_raw_rule(p))
)
{_res=$B._PyPegen.class_def_decorators(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var class_def_raw_var
if(
(class_def_raw_var=class_def_raw_rule(p))
)
{_res=class_def_raw_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function class_def_raw_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_class_def_raw_var
if(
(invalid_class_def_raw_var=invalid_class_def_raw_rule(p))
)
{_res=invalid_class_def_raw_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
var t
if(
(_keyword=$B._PyPegen.expect_token(p,701))
&&
(a=$B._PyPegen.name_token(p))
&&
(t=type_params_rule(p),!p.error_indicator)
&&
(b=_tmp_31_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(c=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ClassDef(a. id,(b )?(b ). args :$B.parser_constants.NULL,(b )?(b ). keywords :$B.parser_constants.NULL,c,$B.parser_constants.NULL,t,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function function_def_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var d
var f
if(
(d=decorators_rule(p))
&&
(f=function_def_raw_rule(p))
)
{_res=$B._PyPegen.function_def_decorators(p,d,f)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var function_def_raw_var
if(
(function_def_raw_var=function_def_raw_rule(p))
)
{_res=function_def_raw_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function function_def_raw_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_def_raw_var
if(
(invalid_def_raw_var=invalid_def_raw_rule(p))
)
{_res=invalid_def_raw_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var _literal_2
var a
var b
var n
var params
var t
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,699))
&&
(n=$B._PyPegen.name_token(p))
&&
(t=type_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(params=params_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(a=_tmp_32_rule(p),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(tc=func_type_comment_rule(p),!p.error_indicator)
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.FunctionDef(n. id,(params )? params :$B.helper_functions.CHECK($B.ast.arguments,$B._PyPegen.empty_arguments(p )),b,$B.parser_constants.NULL,a,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),t,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var _literal_2
var a
var b
var n
var params
var t
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,698))
&&
(_keyword_1=$B._PyPegen.expect_token(p,699))
&&
(n=$B._PyPegen.name_token(p))
&&
(t=type_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(params=params_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(a=_tmp_33_rule(p),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(tc=func_type_comment_rule(p),!p.error_indicator)
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,5,"Async functions are",new $B._PyAST.AsyncFunctionDef(n. id,(params )? params :$B.helper_functions.CHECK($B.ast.arguments,$B._PyPegen.empty_arguments(p )),b,$B.parser_constants.NULL,a,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),t,EXTRA ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function params_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_parameters_var
if(
(invalid_parameters_var=invalid_parameters_rule(p))
)
{_res=invalid_parameters_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var parameters_var
if(
(parameters_var=parameters_rule(p))
)
{_res=parameters_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function parameters_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
var c
var d
if(
(a=slash_no_default_rule(p))
&&
(b=_loop0_34_rule(p))
&&
(c=_loop0_35_rule(p))
&&
(d=star_etc_rule(p),!p.error_indicator)
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.arguments,8,"Positional-only parameters are",$B._PyPegen.make_arguments(p,a,$B.parser_constants.NULL,b,c,d ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=slash_with_default_rule(p))
&&
(b=_loop0_36_rule(p))
&&
(c=star_etc_rule(p),!p.error_indicator)
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.arguments,8,"Positional-only parameters are",$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,a,$B.parser_constants.NULL,b,c ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=_loop1_37_rule(p))
&&
(b=_loop0_38_rule(p))
&&
(c=star_etc_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,a,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_loop1_39_rule(p))
&&
(b=star_etc_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=star_etc_rule(p))
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function slash_no_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(a=_loop1_40_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=_loop1_41_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function slash_with_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=_loop0_42_rule(p))
&&
(b=_loop1_43_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.slash_with_default(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=_loop0_44_rule(p))
&&
(b=_loop1_45_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=$B._PyPegen.slash_with_default(p,a,b)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_etc_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_star_etc_var
if(
(invalid_star_etc_var=invalid_star_etc_rule(p))
)
{_res=invalid_star_etc_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=param_no_default_rule(p))
&&
(b=_loop0_46_rule(p))
&&
(c=kwds_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.star_etc(p,a,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=param_no_default_star_annotation_rule(p))
&&
(b=_loop0_47_rule(p))
&&
(c=kwds_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.star_etc(p,a,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var b
var c
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(b=_loop1_48_rule(p))
&&
(c=kwds_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.star_etc(p,$B.parser_constants.NULL,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=kwds_rule(p))
)
{_res=$B._PyPegen.star_etc(p,$B.parser_constants.NULL,$B.parser_constants.NULL,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function kwds_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_kwds_var
if(
(invalid_kwds_var=invalid_kwds_rule(p))
)
{_res=invalid_kwds_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=param_no_default_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_no_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var tc
if(
(a=param_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
)
{_res=$B._PyPegen.add_type_comment_to_arg(p,a,tc)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var tc
if(
(a=param_rule(p))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=$B._PyPegen.add_type_comment_to_arg(p,a,tc)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_no_default_star_annotation_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var tc
if(
(a=param_star_annotation_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
)
{_res=$B._PyPegen.add_type_comment_to_arg(p,a,tc)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var tc
if(
(a=param_star_annotation_rule(p))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=$B._PyPegen.add_type_comment_to_arg(p,a,tc)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_with_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var c
var tc
if(
(a=param_rule(p))
&&
(c=default_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,tc)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var c
var tc
if(
(a=param_rule(p))
&&
(c=default_rule(p))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,tc)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_maybe_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var c
var tc
if(
(a=param_rule(p))
&&
(c=default_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,tc)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var c
var tc
if(
(a=param_rule(p))
&&
(c=default_rule(p),!p.error_indicator)
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,tc)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(b=annotation_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.arg(a. id,b,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function param_star_annotation_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(b=star_annotation_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.arg(a. id,b,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function annotation_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,11))
&&
(a=expression_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_annotation_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,11))
&&
(a=star_expression_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,22))
&&
(a=expression_rule(p))
)
{_res=a
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_default_var
if(
(invalid_default_var=invalid_default_rule(p))
)
{_res=invalid_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function if_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_if_stmt_var
if(
(invalid_if_stmt_var=invalid_if_stmt_rule(p))
)
{_res=invalid_if_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(a=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
&&
(c=elif_stmt_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.If(a,b,$B.helper_functions.CHECK($B.parser_constants.asdl_stmt_seq,$B._PyPegen.singleton_seq(p,c )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(a=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
&&
(c=else_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.If(a,b,c,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function elif_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_elif_stmt_var
if(
(invalid_elif_stmt_var=invalid_elif_stmt_rule(p))
)
{_res=invalid_elif_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,687))
&&
(a=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
&&
(c=elif_stmt_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.If(a,b,$B.helper_functions.CHECK($B.parser_constants.asdl_stmt_seq,$B._PyPegen.singleton_seq(p,c )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,687))
&&
(a=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
&&
(c=else_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.If(a,b,c,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function else_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_else_stmt_var
if(
(invalid_else_stmt_var=invalid_else_stmt_rule(p))
)
{_res=invalid_else_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
if(
(_keyword=$B._PyPegen.expect_token(p,686))
&&
(_literal=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(b=block_rule(p))
)
{_res=b
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function while_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_while_stmt_var
if(
(invalid_while_stmt_var=invalid_while_stmt_rule(p))
)
{_res=invalid_while_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,689))
&&
(a=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
&&
(c=else_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.While(a,b,c,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function for_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_for_stmt_var
if(
(invalid_for_stmt_var=invalid_for_stmt_rule(p))
)
{_res=invalid_for_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _cut_var=0
var _keyword
var _keyword_1
var _literal
var b
var el
var ex
var t
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,694))
&&
(t=star_targets_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,695))
&&
(_cut_var=1)
&&
(ex=star_expressions_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
(b=block_rule(p))
&&
(el=else_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.For(t,ex,b,el,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA)
break}
p.mark=_mark
if(_cut_var){return NULL}}
{
if(p.error_indicator){return NULL}
var _cut_var=0
var _keyword
var _keyword_1
var _keyword_2
var _literal
var b
var el
var ex
var t
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,698))
&&
(_keyword_1=$B._PyPegen.expect_token(p,694))
&&
(t=star_targets_rule(p))
&&
(_keyword_2=$B._PyPegen.expect_token(p,695))
&&
(_cut_var=1)
&&
(ex=star_expressions_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
(b=block_rule(p))
&&
(el=else_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,5,"Async for loops are",new $B._PyAST.AsyncFor(t,ex,b,el,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA ))
break}
p.mark=_mark
if(_cut_var){return NULL}}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_for_target_var
if(
(invalid_for_target_var=invalid_for_target_rule(p))
)
{_res=invalid_for_target_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function with_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_with_stmt_indent_var
if(
(invalid_with_stmt_indent_var=invalid_with_stmt_indent_rule(p))
)
{_res=invalid_with_stmt_indent_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var a
var b
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,647))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=_gather_49_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.With(a,b,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,647))
&&
(a=_gather_51_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.With(a,b,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(_keyword=$B._PyPegen.expect_token(p,698))
&&
(_keyword_1=$B._PyPegen.expect_token(p,647))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=_gather_53_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,5,"Async with statements are",new $B._PyAST.AsyncWith(a,b,$B.parser_constants.NULL,EXTRA ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var a
var b
var tc
if(
(_keyword=$B._PyPegen.expect_token(p,698))
&&
(_keyword_1=$B._PyPegen.expect_token(p,647))
&&
(a=_gather_55_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(tc=$B._PyPegen.expect_token(p,TYPE_COMMENT),!p.error_indicator)
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,5,"Async with statements are",new $B._PyAST.AsyncWith(a,b,$B.helper_functions.NEW_TYPE_COMMENT(p,tc ),EXTRA ))
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_with_stmt_var
if(
(invalid_with_stmt_var=invalid_with_stmt_rule(p))
)
{_res=invalid_with_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function with_item_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var e
var t
if(
(e=expression_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(t=star_target_rule(p))
&&
$B._PyPegen.lookahead(1,_tmp_57_rule,p)
)
{_res=new $B._PyAST.withitem(e,t,p.arena)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_with_item_var
if(
(invalid_with_item_var=invalid_with_item_rule(p))
)
{_res=invalid_with_item_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var e
if(
(e=expression_rule(p))
)
{_res=new $B._PyAST.withitem(e,$B.parser_constants.NULL,p.arena)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function try_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_try_stmt_var
if(
(invalid_try_stmt_var=invalid_try_stmt_rule(p))
)
{_res=invalid_try_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var f
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(b=block_rule(p))
&&
(f=finally_block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Try(b,$B.parser_constants.NULL,$B.parser_constants.NULL,f,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var el
var ex
var f
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(b=block_rule(p))
&&
(ex=_loop1_58_rule(p))
&&
(el=else_block_rule(p),!p.error_indicator)
&&
(f=finally_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Try(b,ex,el,f,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var el
var ex
var f
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(b=block_rule(p))
&&
(ex=_loop1_59_rule(p))
&&
(el=else_block_rule(p),!p.error_indicator)
&&
(f=finally_block_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,11,"Exception groups are",new $B._PyAST.TryStar(b,ex,el,f,EXTRA ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function except_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_except_stmt_indent_var
if(
(invalid_except_stmt_indent_var=invalid_except_stmt_indent_rule(p))
)
{_res=invalid_except_stmt_indent_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var e
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(e=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ExceptHandler(e,$B.parser_constants.NULL,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var b
var e
var t
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(e=expression_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(t=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ExceptHandler(e,(t ). id,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var e
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(e=expressions_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.excepthandler,14,"except expressions without parentheses are",new $B._PyAST.ExceptHandler(e,$B.parser_constants.NULL,b,EXTRA ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ExceptHandler($B.parser_constants.NULL,$B.parser_constants.NULL,b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_except_stmt_var
if(
(invalid_except_stmt_var=invalid_except_stmt_rule(p))
)
{_res=invalid_except_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function except_star_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_except_star_stmt_indent_var
if(
(invalid_except_star_stmt_indent_var=invalid_except_star_stmt_indent_rule(p))
)
{_res=invalid_except_star_stmt_indent_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var b
var e
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(e=expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ExceptHandler(e,$B.parser_constants.NULL,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var b
var e
var t
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(e=expression_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(t=$B._PyPegen.name_token(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ExceptHandler(e,(t ). id,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var b
var e
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(e=expressions_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(b=block_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.excepthandler,14,"except expressions without parentheses are",new $B._PyAST.ExceptHandler(e,$B.parser_constants.NULL,b,EXTRA ))
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_except_star_stmt_var
if(
(invalid_except_star_stmt_var=invalid_except_star_stmt_rule(p))
)
{_res=invalid_except_star_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function finally_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_finally_stmt_var
if(
(invalid_finally_stmt_var=invalid_finally_stmt_rule(p))
)
{_res=invalid_finally_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
if(
(_keyword=$B._PyPegen.expect_token(p,673))
&&
(_literal=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(a=block_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function match_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var cases
var dedent_var
var indent_var
var newline_var
var subject
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"match"))
&&
(subject=subject_expr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
(indent_var=$B._PyPegen.expect_token(p,INDENT))
&&
(cases=_loop1_60_rule(p))
&&
(dedent_var=$B._PyPegen.expect_token(p,DEDENT))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,10,"Pattern matching is",new $B._PyAST.Match(subject,cases,EXTRA ))
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_match_stmt_var
if(
(invalid_match_stmt_var=invalid_match_stmt_rule(p))
)
{_res=invalid_match_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function subject_expr_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var value
var values
if(
(value=star_named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(values=star_named_expressions_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,value,values )),$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var named_expression_var
if(
(named_expression_var=named_expression_rule(p))
)
{_res=named_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function case_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_case_block_var
if(
(invalid_case_block_var=invalid_case_block_rule(p))
)
{_res=invalid_case_block_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var body
var guard
var pattern
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"case"))
&&
(pattern=patterns_rule(p))
&&
(guard=guard_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(body=block_rule(p))
)
{_res=new $B._PyAST.match_case(pattern,guard,body,p.arena)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function guard_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var guard
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(guard=named_expression_rule(p))
)
{_res=guard
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function patterns_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var patterns
if(
(patterns=open_sequence_pattern_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSequence(patterns,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var pattern_var
if(
(pattern_var=pattern_rule(p))
)
{_res=pattern_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var as_pattern_var
if(
(as_pattern_var=as_pattern_rule(p))
)
{_res=as_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var or_pattern_var
if(
(or_pattern_var=or_pattern_rule(p))
)
{_res=or_pattern_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function as_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var pattern
var target
if(
(pattern=or_pattern_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(target=pattern_capture_target_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchAs(pattern,target. id,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_as_pattern_var
if(
(invalid_as_pattern_var=invalid_as_pattern_rule(p))
)
{_res=invalid_as_pattern_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function or_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var patterns
if(
(patterns=_gather_61_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.asdl_seq_LEN(patterns )==1 ? $B.helper_functions.asdl_seq_GET(patterns,0 ):new $B._PyAST.MatchOr(patterns,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function closed_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,closed_pattern_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var literal_pattern_var
if(
(literal_pattern_var=literal_pattern_rule(p))
)
{_res=literal_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var capture_pattern_var
if(
(capture_pattern_var=capture_pattern_rule(p))
)
{_res=capture_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var wildcard_pattern_var
if(
(wildcard_pattern_var=wildcard_pattern_rule(p))
)
{_res=wildcard_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var value_pattern_var
if(
(value_pattern_var=value_pattern_rule(p))
)
{_res=value_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var group_pattern_var
if(
(group_pattern_var=group_pattern_rule(p))
)
{_res=group_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var sequence_pattern_var
if(
(sequence_pattern_var=sequence_pattern_rule(p))
)
{_res=sequence_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var mapping_pattern_var
if(
(mapping_pattern_var=mapping_pattern_rule(p))
)
{_res=mapping_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var class_pattern_var
if(
(class_pattern_var=class_pattern_rule(p))
)
{_res=class_pattern_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,closed_pattern_type,_res)
return _res}
function literal_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var value
if(
(value=signed_number_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_63_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchValue(value,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var value
if(
(value=complex_number_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchValue(value,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var value
if(
(value=strings_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchValue(value,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,623))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSingleton($B.parser_constants.Py_None,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,622))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSingleton($B.parser_constants.Py_True,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,624))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSingleton($B.parser_constants.Py_False,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function literal_expr_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var signed_number_var
if(
(signed_number_var=signed_number_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_64_rule,p)
)
{_res=signed_number_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var complex_number_var
if(
(complex_number_var=complex_number_rule(p))
)
{_res=complex_number_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var strings_var
if(
$B._PyPegen.lookahead(1,_tmp_65_rule,p)
&&
(strings_var=strings_rule(p))
)
{_res=strings_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,623))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_None,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,622))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_True,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,624))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_False,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function complex_number_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var imag
var real
if(
(real=signed_real_number_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,14))
&&
(imag=imaginary_number_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(real,new $B.ast.Add(),imag,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var imag
var real
if(
(real=signed_real_number_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,15))
&&
(imag=imaginary_number_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(real,new $B.ast.Sub(),imag,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function signed_number_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var number_var
if(
(number_var=$B._PyPegen.number_token(p))
)
{_res=number_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var number
if(
(_literal=$B._PyPegen.expect_token(p,15))
&&
(number=$B._PyPegen.number_token(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.USub(),number,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function signed_real_number_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var real_number_var
if(
(real_number_var=real_number_rule(p))
)
{_res=real_number_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var real
if(
(_literal=$B._PyPegen.expect_token(p,15))
&&
(real=real_number_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.USub(),real,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function real_number_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var real
if(
(real=$B._PyPegen.number_token(p))
)
{_res=$B._PyPegen.ensure_real(p,real)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function imaginary_number_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var imag
if(
(imag=$B._PyPegen.number_token(p))
)
{_res=$B._PyPegen.ensure_imaginary(p,imag)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function capture_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var target
if(
(target=pattern_capture_target_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchAs($B.parser_constants.NULL,target. id,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function pattern_capture_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var name
if(
$B._PyPegen.lookahead_with_string(0,$B._PyPegen.expect_soft_keyword,p,"_")
&&
(name=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead(0,_tmp_66_rule,p)
)
{_res=$B._PyPegen.set_expr_context(p,name,$B.parser_constants.Store)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function wildcard_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"_"))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchAs($B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function value_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var attr
if(
(attr=attr_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_67_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchValue(attr,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function attr_raw(){}
function attr_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,attr_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_1=$B._PyPegen.update_memo(p,_mark,attr_type,_res)
if(tmpvar_1){return _res}
p.mark=_mark
var _raw=attr_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function attr_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var attr
var value
if(
(value=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(attr=$B._PyPegen.name_token(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(value,attr. id,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function name_or_attr_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var attr_var
if(
(attr_var=attr_rule(p))
)
{_res=attr_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
)
{_res=name_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function group_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var pattern
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(pattern=pattern_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=pattern
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function sequence_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var patterns
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(patterns=maybe_sequence_pattern_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSequence(patterns,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var patterns
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(patterns=open_sequence_pattern_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchSequence(patterns,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function open_sequence_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var pattern
var patterns
if(
(pattern=maybe_star_pattern_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(patterns=maybe_sequence_pattern_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.seq_insert_in_front(p,pattern,patterns)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function maybe_sequence_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var patterns
if(
(patterns=_gather_68_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=patterns
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function maybe_star_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var star_pattern_var
if(
(star_pattern_var=star_pattern_rule(p))
)
{_res=star_pattern_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var pattern_var
if(
(pattern_var=pattern_rule(p))
)
{_res=pattern_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,star_pattern_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var target
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(target=pattern_capture_target_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchStar(target. id,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var wildcard_pattern_var
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(wildcard_pattern_var=wildcard_pattern_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchStar($B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,star_pattern_type,_res)
return _res}
function mapping_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchMapping($B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var rest
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(rest=double_star_pattern_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchMapping($B.parser_constants.NULL,$B.parser_constants.NULL,rest. id,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var items
var rest
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(items=items_pattern_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(rest=double_star_pattern_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchMapping($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_pattern_keys(p,items )),$B.helper_functions.CHECK($B.parser_constants.asdl_pattern_seq,$B._PyPegen.get_patterns(p,items )),rest. id,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var items
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(items=items_pattern_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchMapping($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_pattern_keys(p,items )),$B.helper_functions.CHECK($B.parser_constants.asdl_pattern_seq,$B._PyPegen.get_patterns(p,items )),$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function items_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_70_var
if(
(_gather_70_var=_gather_70_rule(p))
)
{_res=_gather_70_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function key_value_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var key
var pattern
if(
(key=_tmp_72_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(pattern=pattern_rule(p))
)
{_res=$B._PyPegen.key_pattern_pair(p,key,pattern)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function double_star_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var target
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(target=pattern_capture_target_rule(p))
)
{_res=target
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function class_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var cls
if(
(cls=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchClass(cls,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var cls
var patterns
if(
(cls=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(patterns=positional_patterns_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchClass(cls,patterns,$B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var cls
var keywords
if(
(cls=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(keywords=keyword_patterns_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchClass(cls,$B.parser_constants.NULL,$B.helper_functions.CHECK($B.parser_constants.asdl_identifier_seq,$B._PyPegen.map_names_to_ids(p,$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_pattern_keys(p,keywords )))),$B.helper_functions.CHECK($B.parser_constants.asdl_pattern_seq,$B._PyPegen.get_patterns(p,keywords )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var cls
var keywords
var patterns
if(
(cls=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(patterns=positional_patterns_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(keywords=keyword_patterns_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.MatchClass(cls,patterns,$B.helper_functions.CHECK($B.parser_constants.asdl_identifier_seq,$B._PyPegen.map_names_to_ids(p,$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_pattern_keys(p,keywords )))),$B.helper_functions.CHECK($B.parser_constants.asdl_pattern_seq,$B._PyPegen.get_patterns(p,keywords )),EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_class_pattern_var
if(
(invalid_class_pattern_var=invalid_class_pattern_rule(p))
)
{_res=invalid_class_pattern_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function positional_patterns_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var args
if(
(args=_gather_73_rule(p))
)
{_res=args
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function keyword_patterns_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_75_var
if(
(_gather_75_var=_gather_75_rule(p))
)
{_res=_gather_75_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function keyword_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var arg
var value
if(
(arg=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(value=pattern_rule(p))
)
{_res=$B._PyPegen.key_pattern_pair(p,arg,value)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_alias_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var b
var n
var t
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"type"))
&&
(n=$B._PyPegen.name_token(p))
&&
(t=type_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.stmt,12,"Type statement is",new $B._PyAST.TypeAlias($B.helper_functions.CHECK($B.ast.expr,$B._PyPegen.set_expr_context(p,n,$B.parser_constants.Store )),t,b,EXTRA ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_params_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_type_params_var
if(
(invalid_type_params_var=invalid_type_params_rule(p))
)
{_res=invalid_type_params_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var t
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(t=type_param_seq_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{_res=$B.helper_functions.CHECK_VERSION($B.parser_constants.asdl_type_param_seq,12,"Type parameter lists are",t)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_param_seq_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_77_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_param_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,type_param_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=$B._PyPegen.name_token(p))
&&
(b=type_param_bound_rule(p),!p.error_indicator)
&&
(c=type_param_default_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.TypeVar(a. id,b,c,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_type_param_var
if(
(invalid_type_param_var=invalid_type_param_rule(p))
)
{_res=invalid_type_param_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=$B._PyPegen.name_token(p))
&&
(b=type_param_starred_default_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.TypeVarTuple(a. id,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=$B._PyPegen.name_token(p))
&&
(b=type_param_default_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ParamSpec(a. id,b,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,type_param_type,_res)
return _res}
function type_param_bound_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var e
if(
(_literal=$B._PyPegen.expect_token(p,11))
&&
(e=expression_rule(p))
)
{_res=e
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_param_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var e
if(
(_literal=$B._PyPegen.expect_token(p,22))
&&
(e=expression_rule(p))
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,13,"Type parameter defaults are",e)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_param_starred_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var e
if(
(_literal=$B._PyPegen.expect_token(p,22))
&&
(e=star_expression_rule(p))
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,13,"Type parameter defaults are",e)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function expressions_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=expression_rule(p))
&&
(b=_loop1_79_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,a,b )),$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.singleton_seq(p,a )),$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,expression_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_expression_var
if(
(invalid_expression_var=invalid_expression_rule(p))
)
{_res=invalid_expression_var
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_legacy_expression_var
if(
(invalid_legacy_expression_var=invalid_legacy_expression_rule(p))
)
{_res=invalid_legacy_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
var b
var c
if(
(a=disjunction_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(b=disjunction_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,686))
&&
(c=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.IfExp(b,a,c,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var disjunction_var
if(
(disjunction_var=disjunction_rule(p))
)
{_res=disjunction_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lambdef_var
if(
(lambdef_var=lambdef_rule(p))
)
{_res=lambdef_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,expression_type,_res)
return _res}
function yield_expr_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
if(
(_keyword=$B._PyPegen.expect_token(p,587))
&&
(_keyword_1=$B._PyPegen.expect_token(p,633))
&&
(a=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.YieldFrom(a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,587))
&&
(a=star_expressions_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Yield(a,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_expressions_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=star_expression_rule(p))
&&
(b=_loop1_80_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,a,b )),$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=star_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.singleton_seq(p,a )),$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var star_expression_var
if(
(star_expression_var=star_expression_rule(p))
)
{_res=star_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,star_expression_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=bitwise_or_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Starred(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,star_expression_type,_res)
return _res}
function star_named_expressions_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_81_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_named_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=bitwise_or_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Starred(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var named_expression_var
if(
(named_expression_var=named_expression_rule(p))
)
{_res=named_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function assignment_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _cut_var=0
var _literal
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,53))
&&
(_cut_var=1)
&&
(b=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,8,"Assignment expressions are",new $B._PyAST.NamedExpr($B.helper_functions.CHECK($B.ast.expr,$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store )),b,EXTRA ))
break}
p.mark=_mark
if(_cut_var){return NULL}}
_res=NULL
break}
return _res}
function named_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var assignment_expression_var
if(
(assignment_expression_var=assignment_expression_rule(p))
)
{_res=assignment_expression_var
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_named_expression_var
if(
(invalid_named_expression_var=invalid_named_expression_rule(p))
)
{_res=invalid_named_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,53)
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function disjunction_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,disjunction_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=conjunction_rule(p))
&&
(b=_loop1_83_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BoolOp(new $B.ast.Or(),$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,a,b )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var conjunction_var
if(
(conjunction_var=conjunction_rule(p))
)
{_res=conjunction_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,disjunction_type,_res)
return _res}
function conjunction_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,conjunction_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=inversion_rule(p))
&&
(b=_loop1_84_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BoolOp(new $B.ast.And(),$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,a,b )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var inversion_var
if(
(inversion_var=inversion_rule(p))
)
{_res=inversion_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,conjunction_type,_res)
return _res}
function inversion_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,inversion_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,703))
&&
(a=inversion_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.Not(),a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var comparison_var
if(
(comparison_var=comparison_rule(p))
)
{_res=comparison_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,inversion_type,_res)
return _res}
function comparison_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=bitwise_or_rule(p))
&&
(b=_loop1_85_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Compare(a,$B.helper_functions.CHECK($B.parser_constants.asdl_int_seq,$B._PyPegen.get_cmpops(p,b )),$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_exprs(p,b )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var bitwise_or_var
if(
(bitwise_or_var=bitwise_or_rule(p))
)
{_res=bitwise_or_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function compare_op_bitwise_or_pair_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var eq_bitwise_or_var
if(
(eq_bitwise_or_var=eq_bitwise_or_rule(p))
)
{_res=eq_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var noteq_bitwise_or_var
if(
(noteq_bitwise_or_var=noteq_bitwise_or_rule(p))
)
{_res=noteq_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lte_bitwise_or_var
if(
(lte_bitwise_or_var=lte_bitwise_or_rule(p))
)
{_res=lte_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lt_bitwise_or_var
if(
(lt_bitwise_or_var=lt_bitwise_or_rule(p))
)
{_res=lt_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var gte_bitwise_or_var
if(
(gte_bitwise_or_var=gte_bitwise_or_rule(p))
)
{_res=gte_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var gt_bitwise_or_var
if(
(gt_bitwise_or_var=gt_bitwise_or_rule(p))
)
{_res=gt_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var notin_bitwise_or_var
if(
(notin_bitwise_or_var=notin_bitwise_or_rule(p))
)
{_res=notin_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var in_bitwise_or_var
if(
(in_bitwise_or_var=in_bitwise_or_rule(p))
)
{_res=in_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var isnot_bitwise_or_var
if(
(isnot_bitwise_or_var=isnot_bitwise_or_rule(p))
)
{_res=isnot_bitwise_or_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var is_bitwise_or_var
if(
(is_bitwise_or_var=is_bitwise_or_rule(p))
)
{_res=is_bitwise_or_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function eq_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,27))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.Eq(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function noteq_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_86_var
var a
if(
(_tmp_86_var=_tmp_86_rule(p))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.NotEq(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lte_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,29))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.LtE(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lt_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,20))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.Lt(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function gte_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,30))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.GtE(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function gt_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,21))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.Gt(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function notin_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
if(
(_keyword=$B._PyPegen.expect_token(p,703))
&&
(_keyword_1=$B._PyPegen.expect_token(p,695))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.NotIn(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function in_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,695))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.In(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function isnot_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
if(
(_keyword=$B._PyPegen.expect_token(p,596))
&&
(_keyword_1=$B._PyPegen.expect_token(p,703))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.IsNot(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function is_bitwise_or_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,596))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.cmpop_expr_pair(p,new $B.ast.Is(),a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function bitwise_or_raw(){}
function bitwise_or_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,bitwise_or_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_2=$B._PyPegen.update_memo(p,_mark,bitwise_or_type,_res)
if(tmpvar_2){return _res}
p.mark=_mark
var _raw=bitwise_or_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function bitwise_or_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=bitwise_or_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,18))
&&
(b=bitwise_xor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.BitOr(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var bitwise_xor_var
if(
(bitwise_xor_var=bitwise_xor_rule(p))
)
{_res=bitwise_xor_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function bitwise_xor_raw(){}
function bitwise_xor_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,bitwise_xor_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_3=$B._PyPegen.update_memo(p,_mark,bitwise_xor_type,_res)
if(tmpvar_3){return _res}
p.mark=_mark
var _raw=bitwise_xor_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function bitwise_xor_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=bitwise_xor_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,32))
&&
(b=bitwise_and_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.BitXor(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var bitwise_and_var
if(
(bitwise_and_var=bitwise_and_rule(p))
)
{_res=bitwise_and_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function bitwise_and_raw(){}
function bitwise_and_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,bitwise_and_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_4=$B._PyPegen.update_memo(p,_mark,bitwise_and_type,_res)
if(tmpvar_4){return _res}
p.mark=_mark
var _raw=bitwise_and_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function bitwise_and_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=bitwise_and_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,19))
&&
(b=shift_expr_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.BitAnd(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var shift_expr_var
if(
(shift_expr_var=shift_expr_rule(p))
)
{_res=shift_expr_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function shift_expr_raw(){}
function shift_expr_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,shift_expr_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_5=$B._PyPegen.update_memo(p,_mark,shift_expr_type,_res)
if(tmpvar_5){return _res}
p.mark=_mark
var _raw=shift_expr_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function shift_expr_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=shift_expr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,33))
&&
(b=sum_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.LShift(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=shift_expr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,34))
&&
(b=sum_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.RShift(),b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_arithmetic_var
if(
(invalid_arithmetic_var=invalid_arithmetic_rule(p))
)
{_res=invalid_arithmetic_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var sum_var
if(
(sum_var=sum_rule(p))
)
{_res=sum_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function sum_raw(){}
function sum_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,sum_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_6=$B._PyPegen.update_memo(p,_mark,sum_type,_res)
if(tmpvar_6){return _res}
p.mark=_mark
var _raw=sum_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function sum_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=sum_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,14))
&&
(b=term_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Add(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=sum_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,15))
&&
(b=term_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Sub(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var term_var
if(
(term_var=term_rule(p))
)
{_res=term_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function term_raw(){}
function term_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,term_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_7=$B._PyPegen.update_memo(p,_mark,term_type,_res)
if(tmpvar_7){return _res}
p.mark=_mark
var _raw=term_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function term_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=term_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Mult(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=term_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Div(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=term_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,47))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.FloorDiv(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=term_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,24))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Mod(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=term_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,49))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,5,"The '@' operator is",new $B._PyAST.BinOp(a,new $B.ast.MatMult(),b,EXTRA ))
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_factor_var
if(
(invalid_factor_var=invalid_factor_rule(p))
)
{_res=invalid_factor_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var factor_var
if(
(factor_var=factor_rule(p))
)
{_res=factor_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function factor_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,factor_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,14))
&&
(a=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.UAdd(),a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,15))
&&
(a=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.USub(),a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,31))
&&
(a=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.UnaryOp(new $B.ast.Invert(),a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var power_var
if(
(power_var=power_rule(p))
)
{_res=power_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,factor_type,_res)
return _res}
function power_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=await_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,35))
&&
(b=factor_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.BinOp(a,new $B.ast.Pow(),b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var await_primary_var
if(
(await_primary_var=await_primary_rule(p))
)
{_res=await_primary_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function await_primary_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,await_primary_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,597))
&&
(a=primary_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,5,"Await expressions are",new $B._PyAST.Await(a,EXTRA ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var primary_var
if(
(primary_var=primary_rule(p))
)
{_res=primary_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,await_primary_type,_res)
return _res}
function primary_raw(){}
function primary_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,primary_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_8=$B._PyPegen.update_memo(p,_mark,primary_type,_res)
if(tmpvar_8){return _res}
p.mark=_mark
var _raw=primary_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function primary_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(a,b. id,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=primary_rule(p))
&&
(b=genexp_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Call(a,$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.singleton_seq(p,b )),$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(b=arguments_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Call(a,(b )?(b ). args :$B.parser_constants.NULL,(b )?(b ). keywords :$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,9))
&&
(b=slices_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Subscript(a,b,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var atom_var
if(
(atom_var=atom_rule(p))
)
{_res=atom_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function slices_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
if(
(a=slice_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,12)
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_87_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function slice_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(a=expression_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=expression_rule(p),!p.error_indicator)
&&
(c=_tmp_89_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Slice(a,b,c,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=named_expression_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function atom_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
)
{_res=name_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,622))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_True,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,624))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_False,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,623))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_None,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var strings_var
if(
$B._PyPegen.lookahead(1,_tmp_90_rule,p)
&&
(strings_var=strings_rule(p))
)
{_res=strings_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var number_var
if(
(number_var=$B._PyPegen.number_token(p))
)
{_res=number_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_91_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,7)
&&
(_tmp_91_var=_tmp_91_rule(p))
)
{_res=_tmp_91_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_92_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,9)
&&
(_tmp_92_var=_tmp_92_rule(p))
)
{_res=_tmp_92_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_93_var
if(
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,25)
&&
(_tmp_93_var=_tmp_93_rule(p))
)
{_res=_tmp_93_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,52))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Constant($B.parser_constants.Py_Ellipsis,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function group_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=_tmp_94_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=a
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_group_var
if(
(invalid_group_var=invalid_group_rule(p))
)
{_res=invalid_group_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambdef_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var a
var b
if(
(_keyword=$B._PyPegen.expect_token(p,621))
&&
(a=lambda_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Lambda((a )? a :$B.helper_functions.CHECK($B.ast.arguments,$B._PyPegen.empty_arguments(p )),b,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_params_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_lambda_parameters_var
if(
(invalid_lambda_parameters_var=invalid_lambda_parameters_rule(p))
)
{_res=invalid_lambda_parameters_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lambda_parameters_var
if(
(lambda_parameters_var=lambda_parameters_rule(p))
)
{_res=lambda_parameters_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_parameters_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
var c
var d
if(
(a=lambda_slash_no_default_rule(p))
&&
(b=_loop0_95_rule(p))
&&
(c=_loop0_96_rule(p))
&&
(d=lambda_star_etc_rule(p),!p.error_indicator)
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.arguments,8,"Positional-only parameters are",$B._PyPegen.make_arguments(p,a,$B.parser_constants.NULL,b,c,d ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=lambda_slash_with_default_rule(p))
&&
(b=_loop0_97_rule(p))
&&
(c=lambda_star_etc_rule(p),!p.error_indicator)
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.arguments,8,"Positional-only parameters are",$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,a,$B.parser_constants.NULL,b,c ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=_loop1_98_rule(p))
&&
(b=_loop0_99_rule(p))
&&
(c=lambda_star_etc_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,a,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_loop1_100_rule(p))
&&
(b=lambda_star_etc_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=lambda_star_etc_rule(p))
)
{_res=$B._PyPegen.make_arguments(p,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,$B.parser_constants.NULL,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_slash_no_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(a=_loop1_101_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=_loop1_102_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,11)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_slash_with_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=_loop0_103_rule(p))
&&
(b=_loop1_104_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.slash_with_default(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=_loop0_105_rule(p))
&&
(b=_loop1_106_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,11)
)
{_res=$B._PyPegen.slash_with_default(p,a,b)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_star_etc_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_lambda_star_etc_var
if(
(invalid_lambda_star_etc_var=invalid_lambda_star_etc_rule(p))
)
{_res=invalid_lambda_star_etc_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var c
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=lambda_param_no_default_rule(p))
&&
(b=_loop0_107_rule(p))
&&
(c=lambda_kwds_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.star_etc(p,a,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var b
var c
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(b=_loop1_108_rule(p))
&&
(c=lambda_kwds_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.star_etc(p,$B.parser_constants.NULL,b,c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=lambda_kwds_rule(p))
)
{_res=$B._PyPegen.star_etc(p,$B.parser_constants.NULL,$B.parser_constants.NULL,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_kwds_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_lambda_kwds_var
if(
(invalid_lambda_kwds_var=invalid_lambda_kwds_rule(p))
)
{_res=invalid_lambda_kwds_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=lambda_param_no_default_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_param_no_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=lambda_param_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=lambda_param_rule(p))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,11)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_param_with_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var c
if(
(a=lambda_param_rule(p))
&&
(c=default_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.name_default_pair(p,a,c,$B.parser_constants.NULL)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var c
if(
(a=lambda_param_rule(p))
&&
(c=default_rule(p))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,11)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,$B.parser_constants.NULL)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_param_maybe_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var c
if(
(a=lambda_param_rule(p))
&&
(c=default_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.name_default_pair(p,a,c,$B.parser_constants.NULL)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var c
if(
(a=lambda_param_rule(p))
&&
(c=default_rule(p),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,11)
)
{_res=$B._PyPegen.name_default_pair(p,a,c,$B.parser_constants.NULL)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function lambda_param_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
if(
(a=$B._PyPegen.name_token(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.arg(a. id,$B.parser_constants.NULL,$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_middle_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var fstring_replacement_field_var
if(
(fstring_replacement_field_var=fstring_replacement_field_rule(p))
)
{_res=fstring_replacement_field_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var t
if(
(t=$B._PyPegen.expect_token(p,FSTRING_MIDDLE))
)
{_res=$B._PyPegen.constant_from_token(p,t)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_replacement_field_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var conversion
var debug_expr
var format
var rbrace
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=annotated_rhs_rule(p))
&&
(debug_expr=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(conversion=fstring_conversion_rule(p),!p.error_indicator)
&&
(format=fstring_full_format_spec_rule(p),!p.error_indicator)
&&
(rbrace=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.formatted_value(p,a,debug_expr,conversion,format,rbrace,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_fstring_replacement_field_var
if(
(invalid_fstring_replacement_field_var=invalid_fstring_replacement_field_rule(p))
)
{_res=invalid_fstring_replacement_field_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_conversion_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var conv
var conv_token
if(
(conv_token=$B._PyPegen.expect_token(p,54))
&&
(conv=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.check_fstring_conversion(p,conv_token,conv)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_full_format_spec_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var colon
var spec
if(
(colon=$B._PyPegen.expect_token(p,11))
&&
(spec=_loop0_109_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.setup_full_format_spec(p,colon,spec,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_format_spec_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var t
if(
(t=$B._PyPegen.expect_token(p,FSTRING_MIDDLE))
)
{_res=$B._PyPegen.decoded_constant_from_token(p,t)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var fstring_replacement_field_var
if(
(fstring_replacement_field_var=fstring_replacement_field_rule(p))
)
{_res=fstring_replacement_field_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function fstring_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=$B._PyPegen.expect_token(p,FSTRING_START))
&&
(b=_loop0_110_rule(p))
&&
(c=$B._PyPegen.expect_token(p,FSTRING_END))
)
{_res=$B._PyPegen.joined_str(p,a,b,c)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_format_spec_replacement_field_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var conversion
var debug_expr
var format
var rbrace
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=annotated_rhs_rule(p))
&&
(debug_expr=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(conversion=fstring_conversion_rule(p),!p.error_indicator)
&&
(format=tstring_full_format_spec_rule(p),!p.error_indicator)
&&
(rbrace=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.formatted_value(p,a,debug_expr,conversion,format,rbrace,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_tstring_replacement_field_var
if(
(invalid_tstring_replacement_field_var=invalid_tstring_replacement_field_rule(p))
)
{_res=invalid_tstring_replacement_field_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_format_spec_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var t
if(
(t=$B._PyPegen.expect_token(p,TSTRING_MIDDLE))
)
{_res=$B._PyPegen.decoded_constant_from_token(p,t)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var tstring_format_spec_replacement_field_var
if(
(tstring_format_spec_replacement_field_var=tstring_format_spec_replacement_field_rule(p))
)
{_res=tstring_format_spec_replacement_field_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_full_format_spec_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var colon
var spec
if(
(colon=$B._PyPegen.expect_token(p,11))
&&
(spec=_loop0_111_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.setup_full_format_spec(p,colon,spec,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_replacement_field_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var conversion
var debug_expr
var format
var rbrace
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=annotated_rhs_rule(p))
&&
(debug_expr=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(conversion=fstring_conversion_rule(p),!p.error_indicator)
&&
(format=tstring_full_format_spec_rule(p),!p.error_indicator)
&&
(rbrace=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.interpolation(p,a,debug_expr,conversion,format,rbrace,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_tstring_replacement_field_var
if(
(invalid_tstring_replacement_field_var=invalid_tstring_replacement_field_rule(p))
)
{_res=invalid_tstring_replacement_field_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_middle_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var tstring_replacement_field_var
if(
(tstring_replacement_field_var=tstring_replacement_field_rule(p))
)
{_res=tstring_replacement_field_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var t
if(
(t=$B._PyPegen.expect_token(p,TSTRING_MIDDLE))
)
{_res=$B._PyPegen.constant_from_token(p,t)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tstring_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,tstring_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
var c
if(
(a=$B._PyPegen.expect_token(p,TSTRING_START))
&&
(b=_loop0_112_rule(p))
&&
(c=$B._PyPegen.expect_token(p,TSTRING_END))
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.expr,14,"t-strings are",$B._PyPegen.template_str(p,a,b,c ))
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,tstring_type,_res)
return _res}
function string_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var s
if(
(s=$B._PyPegen.string_token(p))
)
{_res=$B._PyPegen.constant_from_string(p,s)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function strings_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,strings_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_string_tstring_concat_var
if(
(invalid_string_tstring_concat_var=invalid_string_tstring_concat_rule(p))
)
{_res=invalid_string_tstring_concat_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=_loop1_113_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.concatenate_strings(p,a,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=_loop1_114_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.concatenate_tstrings(p,a,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,strings_type,_res)
return _res}
function list_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(a=star_named_expressions_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.List(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function tuple_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=_tmp_115_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function set_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=star_named_expressions_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Set(a,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function dict_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=double_starred_kvpairs_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Dict($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_keys(p,a )),$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.get_values(p,a )),EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var invalid_double_starred_kvpairs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(invalid_double_starred_kvpairs_var=invalid_double_starred_kvpairs_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{_res=$B._PyPegen.dummy_name(p,_literal,invalid_double_starred_kvpairs_var,_literal_1)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function double_starred_kvpairs_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_116_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function double_starred_kvpair_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=bitwise_or_rule(p))
)
{_res=$B._PyPegen.key_value_pair(p,$B.parser_constants.NULL,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var kvpair_var
if(
(kvpair_var=kvpair_rule(p))
)
{_res=kvpair_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function kvpair_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(b=expression_rule(p))
)
{_res=$B._PyPegen.key_value_pair(p,a,b)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function for_if_clauses_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=_loop1_118_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function for_if_clause_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _cut_var=0
var _keyword
var _keyword_1
var _keyword_2
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,698))
&&
(_keyword_1=$B._PyPegen.expect_token(p,694))
&&
(a=star_targets_rule(p))
&&
(_keyword_2=$B._PyPegen.expect_token(p,695))
&&
(_cut_var=1)
&&
(b=disjunction_rule(p))
&&
(c=_loop0_119_rule(p))
)
{_res=$B.helper_functions.CHECK_VERSION($B.ast.comprehension,6,"Async comprehensions are",new $B._PyAST.comprehension(a,b,c,1,p.arena ))
break}
p.mark=_mark
if(_cut_var){return NULL}}
{
if(p.error_indicator){return NULL}
var _cut_var=0
var _keyword
var _keyword_1
var a
var b
var c
if(
(_keyword=$B._PyPegen.expect_token(p,694))
&&
(a=star_targets_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,695))
&&
(_cut_var=1)
&&
(b=disjunction_rule(p))
&&
(c=_loop0_120_rule(p))
)
{_res=new $B._PyAST.comprehension(a,b,c,0,p.arena)
break}
p.mark=_mark
if(_cut_var){return NULL}}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_for_if_clause_var
if(
(invalid_for_if_clause_var=invalid_for_if_clause_rule(p))
)
{_res=invalid_for_if_clause_var
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_for_target_var
if(
(invalid_for_target_var=invalid_for_target_rule(p))
)
{_res=invalid_for_target_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function listcomp_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(a=named_expression_rule(p))
&&
(b=for_if_clauses_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.ListComp(a,b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_comprehension_var
if(
(invalid_comprehension_var=invalid_comprehension_rule(p))
)
{_res=invalid_comprehension_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function setcomp_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=named_expression_rule(p))
&&
(b=for_if_clauses_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.SetComp(a,b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_comprehension_var
if(
(invalid_comprehension_var=invalid_comprehension_rule(p))
)
{_res=invalid_comprehension_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function genexp_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=_tmp_121_rule(p))
&&
(b=for_if_clauses_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.GeneratorExp(a,b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_comprehension_var
if(
(invalid_comprehension_var=invalid_comprehension_rule(p))
)
{_res=invalid_comprehension_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function dictcomp_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=kvpair_rule(p))
&&
(b=for_if_clauses_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.DictComp(a.key,a.value,b,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_dict_comprehension_var
if(
(invalid_dict_comprehension_var=invalid_dict_comprehension_rule(p))
)
{_res=invalid_dict_comprehension_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function arguments_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,arguments_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=args_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,8)
)
{_res=a
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_arguments_var
if(
(invalid_arguments_var=invalid_arguments_rule(p))
)
{_res=invalid_arguments_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,arguments_type,_res)
return _res}
function args_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_gather_122_rule(p))
&&
(b=_tmp_124_rule(p),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.collect_call_seqs(p,a,b,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=kwargs_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Call($B._PyPegen.dummy_name(p ),$B.helper_functions.CHECK_NULL_ALLOWED($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_extract_starred_exprs(p,a )),$B.helper_functions.CHECK_NULL_ALLOWED($B.parser_constants.asdl_keyword_seq,$B._PyPegen.seq_delete_starred_exprs(p,a )),EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function kwargs_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=_gather_125_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(b=_gather_127_rule(p))
)
{_res=$B._PyPegen.join_sequences(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _gather_129_var
if(
(_gather_129_var=_gather_129_rule(p))
)
{_res=_gather_129_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _gather_131_var
if(
(_gather_131_var=_gather_131_rule(p))
)
{_res=_gather_131_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function starred_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_starred_expression_unpacking_var
if(
(invalid_starred_expression_unpacking_var=invalid_starred_expression_unpacking_rule(p))
)
{_res=invalid_starred_expression_unpacking_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Starred(a,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_starred_expression_var
if(
(invalid_starred_expression_var=invalid_starred_expression_rule(p))
)
{_res=invalid_starred_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function kwarg_or_starred_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_kwarg_var
if(
(invalid_kwarg_var=invalid_kwarg_rule(p))
)
{_res=invalid_kwarg_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.keyword_or_starred(p,$B.helper_functions.CHECK($B.ast.keyword,new $B._PyAST.keyword(a. id,b,EXTRA )),1)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=starred_expression_rule(p))
)
{_res=$B._PyPegen.keyword_or_starred(p,a,0)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function kwarg_or_double_starred_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_kwarg_var
if(
(invalid_kwarg_var=invalid_kwarg_rule(p))
)
{_res=invalid_kwarg_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.keyword_or_starred(p,$B.helper_functions.CHECK($B.ast.keyword,new $B._PyAST.keyword(a. id,b,EXTRA )),1)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=$B._PyPegen.keyword_or_starred(p,$B.helper_functions.CHECK($B.ast.keyword,new $B._PyAST.keyword($B.parser_constants.NULL,a,EXTRA )),1)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_targets_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
if(
(a=star_target_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,12)
)
{_res=a
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=star_target_rule(p))
&&
(b=_loop0_133_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple($B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.seq_insert_in_front(p,a,b )),$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_targets_list_seq_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_134_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_targets_tuple_seq_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=star_target_rule(p))
&&
(b=_loop1_136_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=$B._PyPegen.seq_insert_in_front(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=star_target_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function star_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,star_target_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=_tmp_137_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Starred($B.helper_functions.CHECK($B.ast.expr,$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store )),$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var target_with_star_atom_var
if(
(target_with_star_atom_var=target_with_star_atom_rule(p))
)
{_res=target_with_star_atom_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,star_target_type,_res)
return _res}
function target_with_star_atom_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,target_with_star_atom_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(a,b. id,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,9))
&&
(b=slices_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Subscript(a,b,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var star_atom_var
if(
(star_atom_var=star_atom_rule(p))
)
{_res=star_atom_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,target_with_star_atom_type,_res)
return _res}
function star_atom_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
if(
(a=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=target_with_star_atom_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=star_targets_tuple_seq_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple(a,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(a=star_targets_list_seq_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.List(a,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function single_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var single_subscript_attribute_target_var
if(
(single_subscript_attribute_target_var=single_subscript_attribute_target_rule(p))
)
{_res=single_subscript_attribute_target_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Store)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=single_target_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function single_subscript_attribute_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(a,b. id,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,9))
&&
(b=slices_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Subscript(a,b,$B.parser_constants.Store,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function t_primary_raw(){}
function t_primary_rule(p)
{var _res={value:NULL}
if($B._PyPegen.is_memoized(p,t_primary_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
var _resmark=p.mark
while(1){var tmpvar_9=$B._PyPegen.update_memo(p,_mark,t_primary_type,_res)
if(tmpvar_9){return _res}
p.mark=_mark
var _raw=t_primary_raw(p)
if(p.error_indicator){return NULL}
if(_raw==NULL ||p.mark <=_resmark)
break
_resmark=p.mark
_res=_raw}
p.mark=_resmark
return _res}
function t_primary_raw(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead(1,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(a,b. id,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,9))
&&
(b=slices_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
&&
$B._PyPegen.lookahead(1,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Subscript(a,b,$B.parser_constants.Load,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=t_primary_rule(p))
&&
(b=genexp_rule(p))
&&
$B._PyPegen.lookahead(1,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Call(a,$B.helper_functions.CHECK($B.parser_constants.asdl_expr_seq,$B._PyPegen.singleton_seq(p,b )),$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(b=arguments_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
$B._PyPegen.lookahead(1,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Call(a,(b )?(b ). args :$B.parser_constants.NULL,(b )?(b ). keywords :$B.parser_constants.NULL,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=atom_rule(p))
&&
$B._PyPegen.lookahead(1,t_lookahead_rule,p)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function t_lookahead_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,7))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,9))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,23))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function del_targets_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
if(
(a=_gather_138_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function del_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,del_target_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,23))
&&
(b=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Attribute(a,b. id,$B.parser_constants.Del,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=t_primary_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,9))
&&
(b=slices_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
&&
$B._PyPegen.lookahead(0,t_lookahead_rule,p)
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Subscript(a,b,$B.parser_constants.Del,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var del_t_atom_var
if(
(del_t_atom_var=del_t_atom_rule(p))
)
{_res=del_t_atom_var
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,del_target_type,_res)
return _res}
function del_t_atom_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){return NULL}
var a
if(
(a=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Del)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=del_target_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B._PyPegen.set_expr_context(p,a,$B.parser_constants.Del)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=del_targets_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.Tuple(a,$B.parser_constants.Del,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(a=del_targets_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,10))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.List(a,$B.parser_constants.Del,EXTRA)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function type_expressions_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var _literal_3
var a
var b
var c
if(
(a=_gather_140_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_literal_1=$B._PyPegen.expect_token(p,16))
&&
(b=expression_rule(p))
&&
(_literal_2=$B._PyPegen.expect_token(p,12))
&&
(_literal_3=$B._PyPegen.expect_token(p,35))
&&
(c=expression_rule(p))
)
{_res=$B._PyPegen.seq_append_to_end(p,$B.helper_functions.CHECK(asdl_seq,$B._PyPegen.seq_append_to_end(p,a,b )),c)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=_gather_142_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_literal_1=$B._PyPegen.expect_token(p,16))
&&
(b=expression_rule(p))
)
{_res=$B._PyPegen.seq_append_to_end(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var b
if(
(a=_gather_144_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_literal_1=$B._PyPegen.expect_token(p,35))
&&
(b=expression_rule(p))
)
{_res=$B._PyPegen.seq_append_to_end(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var a
var b
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(_literal_2=$B._PyPegen.expect_token(p,35))
&&
(b=expression_rule(p))
)
{_res=$B._PyPegen.seq_append_to_end(p,$B.helper_functions.CHECK(asdl_seq,$B._PyPegen.singleton_seq(p,a )),b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=expression_rule(p))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=expression_rule(p))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
if(
(a=_gather_146_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function func_type_comment_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var newline_var
var t
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
(t=$B._PyPegen.expect_token(p,TYPE_COMMENT))
&&
$B._PyPegen.lookahead(1,_tmp_148_rule,p)
)
{_res=t
break}
p.mark=_mark}
if(p.call_invalid_rules){
if(p.error_indicator){return NULL}
var invalid_double_type_comments_var
if(
(invalid_double_type_comments_var=invalid_double_type_comments_rule(p))
)
{_res=invalid_double_type_comments_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var type_comment_var
if(
(type_comment_var=$B._PyPegen.expect_token(p,TYPE_COMMENT))
)
{_res=type_comment_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_arguments_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_150_var
var _tmp_149_var
var a
if(
(_tmp_149_var=_tmp_149_rule(p))
&&
(a=$B._PyPegen.expect_token(p,12))
&&
(_gather_150_var=_gather_150_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"iterable argument unpacking follows keyword argument unpacking")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=expression_rule(p))
&&
(b=for_if_clauses_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_opt_var=_tmp_152_rule(p),!p.error_indicator)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,$B._PyPegen.get_last_comprehension_item($B.PyPegen.last_item(b,$B.ast.comprehension )),"Generator expression must be parenthesized")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var expression_var
var for_if_clauses_var
if(
(a=$B._PyPegen.name_token(p))
&&
(b=$B._PyPegen.expect_token(p,22))
&&
(expression_var=expression_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"invalid syntax. Maybe you meant '==' or ':=' instead of '='?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(_opt_var=_tmp_153_rule(p),!p.error_indicator)
&&
(a=$B._PyPegen.name_token(p))
&&
(b=$B._PyPegen.expect_token(p,22))
&&
$B._PyPegen.lookahead(1,_tmp_154_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"expected argument value expression")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=args_rule(p))
&&
(b=for_if_clauses_rule(p))
)
{_res=$B._PyPegen.nonparen_genexp_in_call(p,a,b)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var args_var
var b
if(
(args_var=args_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(a=expression_rule(p))
&&
(b=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,$B._PyPegen.get_last_comprehension_item($B.PyPegen.last_item(b,$B.ast.comprehension )),"Generator expression must be parenthesized")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var args_var
if(
(a=args_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(args_var=args_rule(p))
)
{_res=$B._PyPegen.arguments_parsing_error(p,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_kwarg_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_tmp_155_rule(p))
&&
(b=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"cannot assign to %s",$B.parser_constants.PyBytes_AS_STRING(a.bytes ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var expression_var
var for_if_clauses_var
if(
(a=$B._PyPegen.name_token(p))
&&
(b=$B._PyPegen.expect_token(p,22))
&&
(expression_var=expression_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"invalid syntax. Maybe you meant '==' or ':=' instead of '='?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
$B._PyPegen.lookahead(0,_tmp_156_rule,p)
&&
(a=expression_rule(p))
&&
(b=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"expression cannot contain assignment, perhaps you meant \"==\"?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var expression_var
if(
(a=$B._PyPegen.expect_token(p,35))
&&
(expression_var=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"cannot assign to keyword argument unpacking")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function expression_without_invalid_rule(p)
{var _prev_call_invalid=p.call_invalid_rules
p.call_invalid_rules=0
if(p.error_indicator){p.call_invalid_rules=_prev_call_invalid
return NULL}
while(1){var _res=NULL
var _mark=p.mark
if(p.mark==p.fill && $B._PyPegen.fill_token(p)< 0){p.error_indicator=1
p.call_invalid_rules=_prev_call_invalid
return NULL}
var EXTRA={lineno:p.tokens[_mark].lineno,col_offset:p.tokens[_mark].col_offset}
{
if(p.error_indicator){p.call_invalid_rules=_prev_call_invalid
return NULL}
var _keyword
var _keyword_1
var a
var b
var c
if(
(a=disjunction_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(b=disjunction_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,686))
&&
(c=expression_rule(p))
)
{var _token=$B._PyPegen.get_last_nonnwhitespace_token(p)
if(_token==NULL){p.call_invalid_rules=_prev_call_invalid
return NULL}
EXTRA.end_lineno=_token.end_lineno
EXTRA.end_col_offset=_token.end_col_offset
_res=new $B._PyAST.IfExp(b,a,c,EXTRA)
break}
p.mark=_mark}
{
if(p.error_indicator){p.call_invalid_rules=_prev_call_invalid
return NULL}
var disjunction_var
if(
(disjunction_var=disjunction_rule(p))
)
{_res=disjunction_var
break}
p.mark=_mark}
{
if(p.error_indicator){p.call_invalid_rules=_prev_call_invalid
return NULL}
var lambdef_var
if(
(lambdef_var=lambdef_rule(p))
)
{_res=lambdef_var
break}
p.mark=_mark}
_res=NULL
break}
p.call_invalid_rules=_prev_call_invalid
return _res}
function invalid_legacy_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,7)
&&
(b=star_expressions_rule(p))
)
{_res=$B._PyPegen.check_legacy_stmt(p,a )? $B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"Missing parentheses in call to '%U'. Did you mean %U(...)?",a. id,a. id):$B.parser_constants.NULL
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_type_param_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var colon
var e
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=$B._PyPegen.name_token(p))
&&
(colon=$B._PyPegen.expect_token(p,11))
&&
(e=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,colon,e.kind==Tuple_kind ? "cannot use bound with TypeVarTuple" :"cannot use constraints with TypeVarTuple")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var colon
var e
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(a=$B._PyPegen.name_token(p))
&&
(colon=$B._PyPegen.expect_token(p,11))
&&
(e=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,colon,e.kind==Tuple_kind ? "cannot use bound with ParamSpec" :"cannot use constraints with ParamSpec")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var string_var
var string_var_1
if(
(string_var=$B._PyPegen.string_token(p))
&&
(a=_loop1_157_rule(p))
&&
(string_var_1=$B._PyPegen.string_token(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,$B.PyPegen.first_item(a,$B.ast.expr ),$B.PyPegen.last_item(a,$B.ast.expr ),"invalid syntax. Is this intended to be part of the string?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
$B._PyPegen.lookahead(0,_tmp_158_rule,p)
&&
(a=disjunction_rule(p))
&&
(b=expression_without_invalid_rule(p))
)
{_res=$B._PyPegen.check_legacy_stmt(p,a )? $B.parser_constants.NULL :p.tokens[p.mark-1].level==0 ? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"invalid syntax. Perhaps you forgot a comma?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var a
var b
if(
(a=disjunction_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(b=disjunction_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_159_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"expected 'else' after 'if' expression")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
var b
if(
(a=disjunction_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(b=disjunction_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,686))
&&
$B._PyPegen.lookahead(0,expression_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"expected expression after 'else', but statement is given")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var a
var b
var c
if(
(a=_tmp_160_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(b=disjunction_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,686))
&&
(c=simple_stmt_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expected expression before 'if', but statement is given")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=$B._PyPegen.expect_token(p,621))
&&
(_opt_var=lambda_params_rule(p),!p.error_indicator)
&&
(b=$B._PyPegen.expect_token(p,11))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,FSTRING_MIDDLE)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"f-string: lambda expressions are not allowed without parentheses")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(a=$B._PyPegen.expect_token(p,621))
&&
(_opt_var=lambda_params_rule(p),!p.error_indicator)
&&
(b=$B._PyPegen.expect_token(p,11))
&&
$B._PyPegen.lookahead_with_int(1,$B._PyPegen.expect_token,p,TSTRING_MIDDLE)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"t-string: lambda expressions are not allowed without parentheses")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_named_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res={value:NULL}
if($B._PyPegen.is_memoized(p,invalid_named_expression_type,_res)){return _res.value}
_res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var expression_var
if(
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,53))
&&
(expression_var=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use assignment expressions with %s",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
if(
(a=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=bitwise_or_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_161_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"invalid syntax. Maybe you meant '==' or ':=' instead of '='?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
var bitwise_or_var
if(
$B._PyPegen.lookahead(0,_tmp_162_rule,p)
&&
(a=bitwise_or_rule(p))
&&
(b=$B._PyPegen.expect_token(p,22))
&&
(bitwise_or_var=bitwise_or_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_163_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot assign to %s here. Maybe you meant '==' instead of '='?",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
$B._PyPegen.insert_memo(p,_mark,invalid_named_expression_type,_res)
return _res}
function invalid_assignment_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var expression_var
if(
(a=invalid_ann_assign_target_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(expression_var=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"only single target (not %s) can be annotated",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _loop0_164_var
var a
var expression_var
if(
(a=star_named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_loop0_164_var=_loop0_164_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(expression_var=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"only single target (not tuple) can be annotated")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var expression_var
if(
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(expression_var=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"illegal target for annotation")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_165_var
var a
if(
(_loop0_165_var=_loop0_165_rule(p))
&&
(a=star_expressions_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_INVALID_TARGET(p,$B.parser_constants.STAR_TARGETS,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_166_var
var a
if(
(_loop0_166_var=_loop0_166_rule(p))
&&
(a=yield_expr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"assignment to yield expression not possible")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var annotated_rhs_var
var augassign_var
if(
(a=star_expressions_rule(p))
&&
(augassign_var=augassign_rule(p))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"'%s' is an illegal expression for augmented assignment",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_ann_assign_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var list_var
if(
(list_var=list_rule(p))
)
{_res=list_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var tuple_var
if(
(tuple_var=tuple_rule(p))
)
{_res=tuple_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=invalid_ann_assign_target_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_del_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
if(
(_keyword=$B._PyPegen.expect_token(p,625))
&&
(a=star_expressions_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_INVALID_TARGET(p,$B.parser_constants.DEL_TARGETS,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_comprehension_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_167_var
var a
var for_if_clauses_var
if(
(_tmp_167_var=_tmp_167_rule(p))
&&
(a=starred_expression_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"iterable unpacking cannot be used in comprehension")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _tmp_168_var
var a
var b
var for_if_clauses_var
if(
(_tmp_168_var=_tmp_168_rule(p))
&&
(a=star_named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(b=star_named_expressions_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,$B.PyPegen.last_item(b,$B.ast.expr ),"did you forget parentheses around the comprehension target?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_169_var
var a
var b
var for_if_clauses_var
if(
(_tmp_169_var=_tmp_169_rule(p))
&&
(a=star_named_expression_rule(p))
&&
(b=$B._PyPegen.expect_token(p,12))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"did you forget parentheses around the comprehension target?")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_dict_comprehension_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var bitwise_or_var
var for_if_clauses_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,35))
&&
(bitwise_or_var=bitwise_or_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,26))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"dict unpacking cannot be used in dict comprehension")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_parameters_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=$B._PyPegen.expect_token(p,17))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"at least one argument must precede /")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop0_171_var
var _tmp_170_var
var a
if(
(_tmp_170_var=_tmp_170_rule(p))
&&
(_loop0_171_var=_loop0_171_rule(p))
&&
(a=$B._PyPegen.expect_token(p,17))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"/ may appear only once")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop0_172_var
var _opt_var
UNUSED(_opt_var)
var a
var invalid_parameters_helper_var
if(
(_opt_var=slash_no_default_rule(p),!p.error_indicator)
&&
(_loop0_172_var=_loop0_172_rule(p))
&&
(invalid_parameters_helper_var=invalid_parameters_helper_rule(p))
&&
(a=param_no_default_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"parameter without a default follows parameter with a default")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop0_173_var
var _loop1_174_var
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(_loop0_173_var=_loop0_173_rule(p))
&&
(a=$B._PyPegen.expect_token(p,7))
&&
(_loop1_174_var=_loop1_174_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(b=$B._PyPegen.expect_token(p,8))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"Function parameters cannot be parenthesized")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_176_var
var _loop0_178_var
var _opt_var
UNUSED(_opt_var)
var _tmp_177_var
var a
if(
(_opt_var=_tmp_175_rule(p),!p.error_indicator)
&&
(_loop0_176_var=_loop0_176_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_177_var=_tmp_177_rule(p))
&&
(_loop0_178_var=_loop0_178_rule(p))
&&
(a=$B._PyPegen.expect_token(p,17))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"/ must be ahead of *")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop1_179_var
var a
if(
(_loop1_179_var=_loop1_179_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(a=$B._PyPegen.expect_token(p,16))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expected comma between / and *")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_default_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=$B._PyPegen.expect_token(p,22))
&&
$B._PyPegen.lookahead(1,_tmp_180_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expected default value expression")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_star_etc_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_181_var
var a
if(
(a=$B._PyPegen.expect_token(p,16))
&&
(_tmp_181_var=_tmp_181_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"named arguments must follow bare *")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var type_comment_var
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(type_comment_var=$B._PyPegen.expect_token(p,TYPE_COMMENT))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"bare * has associated type comment")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var param_var
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(param_var=param_rule(p))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"var-positional argument cannot have default value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_183_var
var _tmp_182_var
var _tmp_184_var
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_182_var=_tmp_182_rule(p))
&&
(_loop0_183_var=_loop0_183_rule(p))
&&
(a=$B._PyPegen.expect_token(p,16))
&&
(_tmp_184_var=_tmp_184_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"* argument may appear only once")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_kwds_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(param_var=param_rule(p))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"var-keyword argument cannot have default value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(param_var=param_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(a=param_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"arguments cannot follow var-keyword argument")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(param_var=param_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(a=_tmp_185_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"arguments cannot follow var-keyword argument")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_parameters_helper_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=slash_with_default_rule(p))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop1_186_var
if(
(_loop1_186_var=_loop1_186_rule(p))
)
{_res=_loop1_186_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_lambda_parameters_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(a=$B._PyPegen.expect_token(p,17))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"at least one argument must precede /")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop0_188_var
var _tmp_187_var
var a
if(
(_tmp_187_var=_tmp_187_rule(p))
&&
(_loop0_188_var=_loop0_188_rule(p))
&&
(a=$B._PyPegen.expect_token(p,17))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"/ may appear only once")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop0_189_var
var _opt_var
UNUSED(_opt_var)
var a
var invalid_lambda_parameters_helper_var
if(
(_opt_var=lambda_slash_no_default_rule(p),!p.error_indicator)
&&
(_loop0_189_var=_loop0_189_rule(p))
&&
(invalid_lambda_parameters_helper_var=invalid_lambda_parameters_helper_rule(p))
&&
(a=lambda_param_no_default_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"parameter without a default follows parameter with a default")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _gather_191_var
var _loop0_190_var
var _opt_var
UNUSED(_opt_var)
var a
var b
if(
(_loop0_190_var=_loop0_190_rule(p))
&&
(a=$B._PyPegen.expect_token(p,7))
&&
(_gather_191_var=_gather_191_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(b=$B._PyPegen.expect_token(p,8))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"Lambda expression parameters cannot be parenthesized")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_194_var
var _loop0_196_var
var _opt_var
UNUSED(_opt_var)
var _tmp_195_var
var a
if(
(_opt_var=_tmp_193_rule(p),!p.error_indicator)
&&
(_loop0_194_var=_loop0_194_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_195_var=_tmp_195_rule(p))
&&
(_loop0_196_var=_loop0_196_rule(p))
&&
(a=$B._PyPegen.expect_token(p,17))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"/ must be ahead of *")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop1_197_var
var a
if(
(_loop1_197_var=_loop1_197_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,17))
&&
(a=$B._PyPegen.expect_token(p,16))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expected comma between / and *")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_lambda_parameters_helper_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=lambda_slash_with_default_rule(p))
)
{_res=$B._PyPegen.singleton_seq(p,a)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _loop1_198_var
if(
(_loop1_198_var=_loop1_198_rule(p))
)
{_res=_loop1_198_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_lambda_star_etc_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _tmp_199_var
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_199_var=_tmp_199_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"named arguments must follow bare *")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var lambda_param_var
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(lambda_param_var=lambda_param_rule(p))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"var-positional argument cannot have default value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _loop0_201_var
var _tmp_200_var
var _tmp_202_var
var a
if(
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_200_var=_tmp_200_rule(p))
&&
(_loop0_201_var=_loop0_201_rule(p))
&&
(a=$B._PyPegen.expect_token(p,16))
&&
(_tmp_202_var=_tmp_202_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"* argument may appear only once")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_lambda_kwds_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var lambda_param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(lambda_param_var=lambda_param_rule(p))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"var-keyword argument cannot have default value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var lambda_param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(lambda_param_var=lambda_param_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(a=lambda_param_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"arguments cannot follow var-keyword argument")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var lambda_param_var
if(
(_literal=$B._PyPegen.expect_token(p,35))
&&
(lambda_param_var=lambda_param_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(a=_tmp_203_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"arguments cannot follow var-keyword argument")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_double_type_comments_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var indent_var
var newline_var
var newline_var_1
var type_comment_var
var type_comment_var_1
if(
(type_comment_var=$B._PyPegen.expect_token(p,TYPE_COMMENT))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
(type_comment_var_1=$B._PyPegen.expect_token(p,TYPE_COMMENT))
&&
(newline_var_1=$B._PyPegen.expect_token(p,NEWLINE))
&&
(indent_var=$B._PyPegen.expect_token(p,INDENT))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"Cannot have two type comments on def")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_with_item_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(a=expression_rule(p))
&&
$B._PyPegen.lookahead(1,_tmp_204_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_INVALID_TARGET(p,$B.parser_constants.STAR_TARGETS,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_for_if_clause_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _opt_var
UNUSED(_opt_var)
var _tmp_205_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,694))
&&
(_tmp_205_var=_tmp_205_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,695)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"'in' expected after for-loop variables")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_for_target_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _opt_var
UNUSED(_opt_var)
var a
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,694))
&&
(a=star_expressions_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_INVALID_TARGET(p,$B.parser_constants.FOR_TARGETS,a)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_group_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=starred_expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use starred expression here")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var a
var expression_var
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=$B._PyPegen.expect_token(p,35))
&&
(expression_var=expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use double starred expression here")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_import_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_206_var
var _keyword
var a
var dotted_name_var
if(
(a=$B._PyPegen.expect_token(p,634))
&&
(_gather_206_var=_gather_206_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,633))
&&
(dotted_name_var=dotted_name_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"Did you mean to use 'from ... import ...' instead?")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var token
if(
(_keyword=$B._PyPegen.expect_token(p,634))
&&
(token=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,token,"Expected one or more names after 'import'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_dotted_as_name_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
var dotted_name_var
if(
(dotted_name_var=dotted_name_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
$B._PyPegen.lookahead(0,_tmp_208_rule,p)
&&
(a=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use %s as import target",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_import_from_as_name_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
$B._PyPegen.lookahead(0,_tmp_209_rule,p)
&&
(a=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use %s as import target",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_import_from_targets_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var import_from_as_names_var
var newline_var
if(
(import_from_as_names_var=import_from_as_names_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"trailing comma not allowed without surrounding parentheses")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var token
if(
(token=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,token,"Expected one or more names after 'import'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_with_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_210_var
var _keyword
var _opt_var
UNUSED(_opt_var)
var newline_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,647))
&&
(_gather_210_var=_gather_210_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _gather_212_var
var _keyword
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var newline_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,647))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_gather_212_var=_gather_212_rule(p))
&&
(_opt_var_1=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_with_stmt_indent_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_214_var
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var newline_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(a=$B._PyPegen.expect_token(p,647))
&&
(_gather_214_var=_gather_214_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'with' statement on line %d",a.lineno)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _gather_216_var
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var a
var newline_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(a=$B._PyPegen.expect_token(p,647))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_gather_216_var=_gather_216_rule(p))
&&
(_opt_var_1=$B._PyPegen.expect_token(p,12),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'with' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_try_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var newline_var
if(
(a=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'try' statement on line %d",a.lineno)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var block_var
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(block_var=block_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_218_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected 'except' or 'finally' block")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var _loop0_219_var
var _loop1_220_var
var _opt_var
UNUSED(_opt_var)
var a
var b
var expression_var
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(_loop0_219_var=_loop0_219_rule(p))
&&
(_loop1_220_var=_loop1_220_rule(p))
&&
(a=$B._PyPegen.expect_token(p,677))
&&
(b=$B._PyPegen.expect_token(p,16))
&&
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_221_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"cannot have both 'except' and 'except*' on the same 'try'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var _loop0_222_var
var _loop1_223_var
var _opt_var
UNUSED(_opt_var)
var a
if(
(_keyword=$B._PyPegen.expect_token(p,656))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(_loop0_222_var=_loop0_222_rule(p))
&&
(_loop1_223_var=_loop1_223_rule(p))
&&
(a=$B._PyPegen.expect_token(p,677))
&&
(_opt_var=_tmp_224_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot have both 'except' and 'except*' on the same 'try'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_except_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var a
var expressions_var
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(expressions_var=expressions_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"multiple exception types must be parenthesized when using 'as'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var a
var expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_225_rule(p),!p.error_indicator)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var a
var block_var
var expression_var
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(expression_var=expression_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(a=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(block_var=block_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use except statement with %s",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_except_star_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var _literal_2
var a
var expressions_var
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(a=expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,12))
&&
(expressions_var=expressions_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"multiple exception types must be parenthesized when using 'as'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_226_rule(p),!p.error_indicator)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _tmp_227_var
var a
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(_tmp_227_var=_tmp_227_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected one or more exception types")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var _literal_1
var a
var block_var
var expression_var
if(
(_keyword=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(expression_var=expression_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,680))
&&
(a=expression_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(block_var=block_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use except* statement with %s",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_finally_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var newline_var
if(
(a=$B._PyPegen.expect_token(p,673))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'finally' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_except_stmt_indent_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_228_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'except' statement on line %d",a.lineno)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'except' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_except_star_stmt_indent_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
var a
var expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,677))
&&
(_literal=$B._PyPegen.expect_token(p,16))
&&
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_229_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'except*' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_match_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var newline_var
var subject_expr_var
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"match"))
&&
(subject_expr_var=subject_expr_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.CHECK_VERSION(NULL,10,"expected ':'",$B.helper_functions.RAISE_SYNTAX_ERROR(p,"Pattern matching is" ))
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var newline_var
var subject
if(
(a=$B._PyPegen.expect_soft_keyword(p,"match"))
&&
(subject=subject_expr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'match' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_case_block_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _opt_var
UNUSED(_opt_var)
var newline_var
var patterns_var
if(
(_keyword=$B._PyPegen.expect_soft_keyword(p,"case"))
&&
(patterns_var=patterns_rule(p))
&&
(_opt_var=guard_rule(p),!p.error_indicator)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var newline_var
var patterns_var
if(
(a=$B._PyPegen.expect_soft_keyword(p,"case"))
&&
(patterns_var=patterns_rule(p))
&&
(_opt_var=guard_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'case' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_as_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var a
var or_pattern_var
if(
(or_pattern_var=or_pattern_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(a=$B._PyPegen.expect_soft_keyword(p,"_"))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use '_' as a target")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var a
var or_pattern_var
if(
(or_pattern_var=or_pattern_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(a=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"cannot use %s as pattern target",$B._PyPegen.get_expr_name(a ))
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_class_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var name_or_attr_var
if(
(name_or_attr_var=name_or_attr_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(a=invalid_class_argument_pattern_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,$B.PyPegen.first_item(a,$B.ast.pattern ),$B.PyPegen.last_item(a,$B.ast.pattern ),"positional patterns follow keyword patterns")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_class_argument_pattern_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var keyword_patterns_var
if(
(_opt_var=_tmp_230_rule(p),!p.error_indicator)
&&
(keyword_patterns_var=keyword_patterns_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(a=positional_patterns_rule(p))
)
{_res=a
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_if_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var named_expression_var
var newline_var
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(named_expression_var=named_expression_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var a_1
var newline_var
if(
(a=$B._PyPegen.expect_token(p,682))
&&
(a_1=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'if' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_elif_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var named_expression_var
var newline_var
if(
(_keyword=$B._PyPegen.expect_token(p,687))
&&
(named_expression_var=named_expression_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var named_expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,687))
&&
(named_expression_var=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'elif' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_else_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var newline_var
if(
(a=$B._PyPegen.expect_token(p,686))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'else' statement on line %d",a.lineno)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _literal
var block_var
if(
(_keyword=$B._PyPegen.expect_token(p,686))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(block_var=block_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,687))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"'elif' block follows an 'else' block")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_while_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var named_expression_var
var newline_var
if(
(_keyword=$B._PyPegen.expect_token(p,689))
&&
(named_expression_var=named_expression_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var named_expression_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,689))
&&
(named_expression_var=named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'while' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_for_stmt_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _keyword_1
var _opt_var
UNUSED(_opt_var)
var newline_var
var star_expressions_var
var star_targets_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,694))
&&
(star_targets_var=star_targets_rule(p))
&&
(_keyword_1=$B._PyPegen.expect_token(p,695))
&&
(star_expressions_var=star_expressions_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _opt_var
UNUSED(_opt_var)
var a
var newline_var
var star_expressions_var
var star_targets_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(a=$B._PyPegen.expect_token(p,694))
&&
(star_targets_var=star_targets_rule(p))
&&
(_keyword=$B._PyPegen.expect_token(p,695))
&&
(star_expressions_var=star_expressions_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after 'for' statement on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_def_raw_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var _opt_var_2
UNUSED(_opt_var_2)
var _opt_var_3
UNUSED(_opt_var_3)
var a
var name_var
var newline_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(a=$B._PyPegen.expect_token(p,699))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_opt_var_1=type_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_opt_var_2=params_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_opt_var_3=_tmp_231_rule(p),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after function definition on line %d",a.lineno)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
var _literal
var _literal_1
var _literal_2
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var _opt_var_2
UNUSED(_opt_var_2)
var _opt_var_3
UNUSED(_opt_var_3)
var _opt_var_4
UNUSED(_opt_var_4)
var block_var
var name_var
if(
(_opt_var=$B._PyPegen.expect_token(p,698),!p.error_indicator)
&&
(_keyword=$B._PyPegen.expect_token(p,699))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_opt_var_1=type_params_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_forced_token(p,7,"("))
&&
(_opt_var_2=params_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
&&
(_opt_var_3=_tmp_232_rule(p),!p.error_indicator)
&&
(_literal_2=$B._PyPegen.expect_forced_token(p,11,":"))
&&
(_opt_var_4=func_type_comment_rule(p),!p.error_indicator)
&&
(block_var=block_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_opt_var,_keyword,name_var,_opt_var_1,_literal,_opt_var_2,_literal_1,_opt_var_3,_literal_2,_opt_var_4,block_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_class_def_raw_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var name_var
var newline_var
if(
(_keyword=$B._PyPegen.expect_token(p,701))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_opt_var=type_params_rule(p),!p.error_indicator)
&&
(_opt_var_1=_tmp_233_rule(p),!p.error_indicator)
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"expected ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var a
var name_var
var newline_var
if(
(a=$B._PyPegen.expect_token(p,701))
&&
(name_var=$B._PyPegen.name_token(p))
&&
(_opt_var=type_params_rule(p),!p.error_indicator)
&&
(_opt_var_1=_tmp_234_rule(p),!p.error_indicator)
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,INDENT)
)
{_res=$B.helper_functions.RAISE_INDENTATION_ERROR(p,"expected an indented block after class definition on line %d",a.lineno)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_double_starred_kvpairs_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_235_var
var _literal
var invalid_kvpair_var
if(
(_gather_235_var=_gather_235_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(invalid_kvpair_var=invalid_kvpair_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_gather_235_var,_literal,invalid_kvpair_var)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var bitwise_or_var
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(a=$B._PyPegen.expect_token(p,16))
&&
(bitwise_or_var=bitwise_or_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"cannot use a starred expression in a dictionary value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var expression_var
if(
(expression_var=expression_rule(p))
&&
(a=$B._PyPegen.expect_token(p,11))
&&
$B._PyPegen.lookahead(1,_tmp_237_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expression expected after dictionary key and ':'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_kvpair_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
if(
(a=expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,11)
)
{_res=$B.helper_functions.RAISE_ERROR_KNOWN_LOCATION(p,$B.parser_constants.PyExc_SyntaxError,a.lineno,a.end_col_offset-1,a.end_lineno,-1,"':' expected after dictionary key")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
var bitwise_or_var
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,11))
&&
(a=$B._PyPegen.expect_token(p,16))
&&
(bitwise_or_var=bitwise_or_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,a,"cannot use a starred expression in a dictionary value")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var expression_var
if(
(expression_var=expression_rule(p))
&&
(a=$B._PyPegen.expect_token(p,11))
&&
$B._PyPegen.lookahead(1,_tmp_238_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"expression expected after dictionary key and ':'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_starred_expression_unpacking_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
var b
var expression_var
if(
(a=$B._PyPegen.expect_token(p,16))
&&
(expression_var=expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
&&
(b=expression_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"cannot assign to iterable argument unpacking")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_starred_expression_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,16))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR(p,"Invalid star expression")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_fstring_replacement_field_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"f-string: valid expression required before '='")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,54))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"f-string: valid expression required before '!'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"f-string: valid expression required before ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,26))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"f-string: valid expression required before '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
$B._PyPegen.lookahead(0,annotated_rhs_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting a valid expression after '{'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_239_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting '=', or '!', or ':', or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,22))
&&
$B._PyPegen.lookahead(0,_tmp_240_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting '!', or ':', or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var annotated_rhs_var
var invalid_fstring_conversion_character_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(invalid_fstring_conversion_character_var=invalid_fstring_conversion_character_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,annotated_rhs_var,_opt_var,invalid_fstring_conversion_character_var)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_241_rule(p),!p.error_indicator)
&&
$B._PyPegen.lookahead(0,_tmp_242_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting ':' or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _loop0_244_var
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_243_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(_loop0_244_var=_loop0_244_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,26)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting '}', or format specs")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_245_rule(p),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,26)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: expecting '}'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_fstring_conversion_character_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
$B._PyPegen.lookahead(1,_tmp_246_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: missing conversion character")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
$B._PyPegen.lookahead_with_name(0,$B._PyPegen.name_token,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"f-string: invalid conversion character")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_tstring_replacement_field_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,22))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"t-string: valid expression required before '='")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,54))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"t-string: valid expression required before '!'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,11))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"t-string: valid expression required before ':'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var a
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(a=$B._PyPegen.expect_token(p,26))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_LOCATION(p,a,"t-string: valid expression required before '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
$B._PyPegen.lookahead(0,annotated_rhs_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting a valid expression after '{'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
$B._PyPegen.lookahead(0,_tmp_247_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting '=', or '!', or ':', or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,22))
&&
$B._PyPegen.lookahead(0,_tmp_248_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting '!', or ':', or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var annotated_rhs_var
var invalid_tstring_conversion_character_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(invalid_tstring_conversion_character_var=invalid_tstring_conversion_character_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,annotated_rhs_var,_opt_var,invalid_tstring_conversion_character_var)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_249_rule(p),!p.error_indicator)
&&
$B._PyPegen.lookahead(0,_tmp_250_rule,p)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting ':' or '}'")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _loop0_252_var
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_251_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,11))
&&
(_loop0_252_var=_loop0_252_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,26)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting '}', or format specs")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _opt_var
UNUSED(_opt_var)
var _opt_var_1
UNUSED(_opt_var_1)
var annotated_rhs_var
if(
(_literal=$B._PyPegen.expect_token(p,25))
&&
(annotated_rhs_var=annotated_rhs_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,22),!p.error_indicator)
&&
(_opt_var_1=_tmp_253_rule(p),!p.error_indicator)
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,26)
)
{_res=$B.helper_functions.PyErr_Occurred()? $B.parser_constants.NULL :$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: expecting '}'")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_tstring_conversion_character_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
$B._PyPegen.lookahead(1,_tmp_254_rule,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: missing conversion character")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
$B._PyPegen.lookahead_with_name(0,$B._PyPegen.name_token,p)
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_ON_NEXT_TOKEN(p,"t-string: invalid conversion character")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_string_tstring_concat_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_loop1_255_rule(p))
&&
(b=tstring_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,$B.PyPegen.last_item(a,$B.ast.expr ),b,"cannot mix t-string literals with string or bytes literals")
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var a
var b
if(
(a=_loop1_256_rule(p))
&&
(b=_tmp_257_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,$B.PyPegen.last_item(a,$B.ast.expr ),b,"cannot mix t-string literals with string or bytes literals")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_arithmetic_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_258_var
var a
var b
var sum_var
if(
(sum_var=sum_rule(p))
&&
(_tmp_258_var=_tmp_258_rule(p))
&&
(a=$B._PyPegen.expect_token(p,703))
&&
(b=inversion_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"'not' after an operator must be parenthesized")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_factor_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_259_var
var a
var b
if(
(_tmp_259_var=_tmp_259_rule(p))
&&
(a=$B._PyPegen.expect_token(p,703))
&&
(b=factor_rule(p))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_KNOWN_RANGE(p,a,b,"'not' after an operator must be parenthesized")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function invalid_type_params_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var token
if(
(_literal=$B._PyPegen.expect_token(p,9))
&&
(token=$B._PyPegen.expect_token(p,10))
)
{_res=$B.helper_functions.RAISE_SYNTAX_ERROR_STARTING_FROM(p,token,"Type parameter list cannot be empty")
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_1_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var newline_var
while(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_2_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var newline_var
while(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_3_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var statement_var
while(
(statement_var=statement_rule(p))
)
{_res=statement_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_5_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,13))
&&
(elem=simple_stmt_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_4_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=simple_stmt_rule(p))
&&
(seq=_loop0_5_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_6_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,634))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,633))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_7_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,699))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,49))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,698))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_8_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,701))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,49))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_9_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,647))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,698))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_10_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,694))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,698))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_11_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var d
if(
(_literal=$B._PyPegen.expect_token(p,22))
&&
(d=annotated_rhs_rule(p))
)
{_res=d
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_12_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var b
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(b=single_target_rule(p))
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=b
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var single_subscript_attribute_target_var
if(
(single_subscript_attribute_target_var=single_subscript_attribute_target_rule(p))
)
{_res=single_subscript_attribute_target_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_13_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var d
if(
(_literal=$B._PyPegen.expect_token(p,22))
&&
(d=annotated_rhs_rule(p))
)
{_res=d
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_14_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_260_var
while(
(_tmp_260_var=_tmp_260_rule(p))
)
{_res=_tmp_260_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_15_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var z
if(
(_keyword=$B._PyPegen.expect_token(p,633))
&&
(z=expression_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_17_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=$B._PyPegen.name_token(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_16_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=$B._PyPegen.name_token(p))
&&
(seq=_loop0_17_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_19_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=$B._PyPegen.name_token(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_18_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=$B._PyPegen.name_token(p))
&&
(seq=_loop0_19_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_20_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,13))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_21_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var z
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(z=expression_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_22_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_261_var
while(
(_tmp_261_var=_tmp_261_rule(p))
)
{_res=_tmp_261_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_23_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_262_var
while(
(_tmp_262_var=_tmp_262_rule(p))
)
{_res=_tmp_262_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_25_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=import_from_as_name_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_24_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=import_from_as_name_rule(p))
&&
(seq=_loop0_25_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_26_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var z
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(z=$B._PyPegen.name_token(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_28_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=dotted_as_name_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_27_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=dotted_as_name_rule(p))
&&
(seq=_loop0_28_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_29_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var z
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(z=$B._PyPegen.name_token(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_30_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_263_var
while(
(_tmp_263_var=_tmp_263_rule(p))
)
{_res=_tmp_263_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_31_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var z
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(z=arguments_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_32_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var z
if(
(_literal=$B._PyPegen.expect_token(p,51))
&&
(z=expression_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_33_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var z
if(
(_literal=$B._PyPegen.expect_token(p,51))
&&
(z=expression_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_34_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_35_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_36_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_37_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_38_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_39_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_40_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_41_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_42_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_43_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_44_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_45_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_46_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_47_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_48_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_50_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=with_item_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_49_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=with_item_rule(p))
&&
(seq=_loop0_50_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_52_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=with_item_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_51_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=with_item_rule(p))
&&
(seq=_loop0_52_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_54_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=with_item_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_53_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=with_item_rule(p))
&&
(seq=_loop0_54_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_56_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=with_item_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_55_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=with_item_rule(p))
&&
(seq=_loop0_56_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_57_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_58_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var except_block_var
while(
(except_block_var=except_block_rule(p))
)
{_res=except_block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_59_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var except_star_block_var
while(
(except_star_block_var=except_star_block_rule(p))
)
{_res=except_star_block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_60_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var case_block_var
while(
(case_block_var=case_block_rule(p))
)
{_res=case_block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_62_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,18))
&&
(elem=closed_pattern_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_61_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=closed_pattern_rule(p))
&&
(seq=_loop0_62_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_63_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,14))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,15))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_64_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,14))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,15))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_65_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var string_var
if(
(string_var=$B._PyPegen.string_token(p))
)
{_res=string_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var fstring_start_var
if(
(fstring_start_var=$B._PyPegen.expect_token(p,FSTRING_START))
)
{_res=fstring_start_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var tstring_start_var
if(
(tstring_start_var=$B._PyPegen.expect_token(p,TSTRING_START))
)
{_res=tstring_start_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_66_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,23))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,7))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_67_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,23))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,7))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_69_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=maybe_star_pattern_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_68_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=maybe_star_pattern_rule(p))
&&
(seq=_loop0_69_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_71_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=key_value_pattern_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_70_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=key_value_pattern_rule(p))
&&
(seq=_loop0_71_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_72_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var literal_expr_var
if(
(literal_expr_var=literal_expr_rule(p))
)
{_res=literal_expr_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var attr_var
if(
(attr_var=attr_rule(p))
)
{_res=attr_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_74_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=pattern_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_73_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=pattern_rule(p))
&&
(seq=_loop0_74_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_76_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=keyword_pattern_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_75_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=keyword_pattern_rule(p))
&&
(seq=_loop0_76_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_78_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=type_param_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_77_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=type_param_rule(p))
&&
(seq=_loop0_78_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_79_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_264_var
while(
(_tmp_264_var=_tmp_264_rule(p))
)
{_res=_tmp_264_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_80_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_265_var
while(
(_tmp_265_var=_tmp_265_rule(p))
)
{_res=_tmp_265_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_82_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=star_named_expression_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_81_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=star_named_expression_rule(p))
&&
(seq=_loop0_82_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_83_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_266_var
while(
(_tmp_266_var=_tmp_266_rule(p))
)
{_res=_tmp_266_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_84_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_267_var
while(
(_tmp_267_var=_tmp_267_rule(p))
)
{_res=_tmp_267_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_85_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var compare_op_bitwise_or_pair_var
while(
(compare_op_bitwise_or_pair_var=compare_op_bitwise_or_pair_rule(p))
)
{_res=compare_op_bitwise_or_pair_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_86_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var tok
if(
(tok=$B._PyPegen.expect_token(p,28))
)
{_res=$B._PyPegen.check_barry_as_flufl(p,tok)? $B.parser_constants.NULL :tok
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_88_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_268_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_87_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_268_rule(p))
&&
(seq=_loop0_88_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_89_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var d
if(
(_literal=$B._PyPegen.expect_token(p,11))
&&
(d=expression_rule(p),!p.error_indicator)
)
{_res=d
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_90_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var string_var
if(
(string_var=$B._PyPegen.string_token(p))
)
{_res=string_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var fstring_start_var
if(
(fstring_start_var=$B._PyPegen.expect_token(p,FSTRING_START))
)
{_res=fstring_start_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var tstring_start_var
if(
(tstring_start_var=$B._PyPegen.expect_token(p,TSTRING_START))
)
{_res=tstring_start_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_91_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var tuple_var
if(
(tuple_var=tuple_rule(p))
)
{_res=tuple_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var group_var
if(
(group_var=group_rule(p))
)
{_res=group_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var genexp_var
if(
(genexp_var=genexp_rule(p))
)
{_res=genexp_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_92_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var list_var
if(
(list_var=list_rule(p))
)
{_res=list_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var listcomp_var
if(
(listcomp_var=listcomp_rule(p))
)
{_res=listcomp_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_93_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var dict_var
if(
(dict_var=dict_rule(p))
)
{_res=dict_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var set_var
if(
(set_var=set_rule(p))
)
{_res=set_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var dictcomp_var
if(
(dictcomp_var=dictcomp_rule(p))
)
{_res=dictcomp_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var setcomp_var
if(
(setcomp_var=setcomp_rule(p))
)
{_res=setcomp_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_94_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var yield_expr_var
if(
(yield_expr_var=yield_expr_rule(p))
)
{_res=yield_expr_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var named_expression_var
if(
(named_expression_var=named_expression_rule(p))
)
{_res=named_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_95_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_96_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_97_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_98_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_99_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_100_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_101_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_102_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_103_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_104_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_105_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_106_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_107_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_108_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_109_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var fstring_format_spec_var
while(
(fstring_format_spec_var=fstring_format_spec_rule(p))
)
{_res=fstring_format_spec_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_110_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var fstring_middle_var
while(
(fstring_middle_var=fstring_middle_rule(p))
)
{_res=fstring_middle_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_111_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var tstring_format_spec_var
while(
(tstring_format_spec_var=tstring_format_spec_rule(p))
)
{_res=tstring_format_spec_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_112_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var tstring_middle_var
while(
(tstring_middle_var=tstring_middle_rule(p))
)
{_res=tstring_middle_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_113_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_269_var
while(
(_tmp_269_var=_tmp_269_rule(p))
)
{_res=_tmp_269_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_114_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var tstring_var
while(
(tstring_var=tstring_rule(p))
)
{_res=tstring_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_115_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var y
var z
if(
(y=star_named_expression_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(z=star_named_expressions_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.seq_insert_in_front(p,y,z)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_117_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=double_starred_kvpair_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_116_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=double_starred_kvpair_rule(p))
&&
(seq=_loop0_117_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_118_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var for_if_clause_var
while(
(for_if_clause_var=for_if_clause_rule(p))
)
{_res=for_if_clause_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop0_119_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_270_var
while(
(_tmp_270_var=_tmp_270_rule(p))
)
{_res=_tmp_270_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_120_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_271_var
while(
(_tmp_271_var=_tmp_271_rule(p))
)
{_res=_tmp_271_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_121_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var assignment_expression_var
if(
(assignment_expression_var=assignment_expression_rule(p))
)
{_res=assignment_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,53)
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_123_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_272_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_122_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_272_rule(p))
&&
(seq=_loop0_123_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_124_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var k
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(k=kwargs_rule(p))
)
{_res=k
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_126_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=kwarg_or_starred_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_125_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=kwarg_or_starred_rule(p))
&&
(seq=_loop0_126_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_128_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=kwarg_or_double_starred_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_127_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=kwarg_or_double_starred_rule(p))
&&
(seq=_loop0_128_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_130_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=kwarg_or_starred_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_129_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=kwarg_or_starred_rule(p))
&&
(seq=_loop0_130_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_132_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=kwarg_or_double_starred_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_131_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=kwarg_or_double_starred_rule(p))
&&
(seq=_loop0_132_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_133_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_273_var
while(
(_tmp_273_var=_tmp_273_rule(p))
)
{_res=_tmp_273_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_135_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=star_target_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_134_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=star_target_rule(p))
&&
(seq=_loop0_135_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_136_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_274_var
while(
(_tmp_274_var=_tmp_274_rule(p))
)
{_res=_tmp_274_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_137_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var star_target_var
if(
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,16)
&&
(star_target_var=star_target_rule(p))
)
{_res=star_target_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_139_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=del_target_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_138_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=del_target_rule(p))
&&
(seq=_loop0_139_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_141_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=expression_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_140_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=expression_rule(p))
&&
(seq=_loop0_141_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_143_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=expression_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_142_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=expression_rule(p))
&&
(seq=_loop0_143_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_145_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=expression_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_144_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=expression_rule(p))
&&
(seq=_loop0_145_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_147_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=expression_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_146_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=expression_rule(p))
&&
(seq=_loop0_147_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_148_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var indent_var
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
&&
(indent_var=$B._PyPegen.expect_token(p,INDENT))
)
{_res=$B._PyPegen.dummy_name(p,newline_var,indent_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_149_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_275_var
if(
(_tmp_275_var=_tmp_275_rule(p))
)
{_res=_tmp_275_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var kwargs_var
if(
(kwargs_var=kwargs_rule(p))
)
{_res=kwargs_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_151_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_276_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_150_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_276_rule(p))
&&
(seq=_loop0_151_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_152_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var args_var
if(
(args_var=args_rule(p))
)
{_res=args_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
var for_if_clauses_var
if(
(expression_var=expression_rule(p))
&&
(for_if_clauses_var=for_if_clauses_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,expression_var,for_if_clauses_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_153_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var args_var
if(
(args_var=args_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.dummy_name(p,args_var,_literal)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_154_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_155_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,622))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,624))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,623))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_156_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=$B._PyPegen.dummy_name(p,name_var,_literal)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_157_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_277_var
while(
(_tmp_277_var=_tmp_277_rule(p))
)
{_res=_tmp_277_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_158_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var name_var
var string_var
if(
(name_var=$B._PyPegen.name_token(p))
&&
(string_var=$B._PyPegen.string_token(p))
)
{_res=$B._PyPegen.dummy_name(p,name_var,string_var)
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var soft_keyword_var
if(
(soft_keyword_var=$B._PyPegen.soft_keyword_token(p))
)
{_res=soft_keyword_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_159_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,686))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_160_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var pass_stmt_var
if(
(pass_stmt_var=pass_stmt_rule(p))
)
{_res=pass_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var break_stmt_var
if(
(break_stmt_var=break_stmt_rule(p))
)
{_res=break_stmt_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var continue_stmt_var
if(
(continue_stmt_var=continue_stmt_rule(p))
)
{_res=continue_stmt_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_161_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,53))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_162_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var list_var
if(
(list_var=list_rule(p))
)
{_res=list_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var tuple_var
if(
(tuple_var=tuple_rule(p))
)
{_res=tuple_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var genexp_var
if(
(genexp_var=genexp_rule(p))
)
{_res=genexp_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,622))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,623))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,624))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_163_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,53))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_164_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var star_named_expressions_var
while(
(star_named_expressions_var=star_named_expressions_rule(p))
)
{_res=star_named_expressions_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_165_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_278_var
while(
(_tmp_278_var=_tmp_278_rule(p))
)
{_res=_tmp_278_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_166_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_279_var
while(
(_tmp_279_var=_tmp_279_rule(p))
)
{_res=_tmp_279_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_167_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,9))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,7))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,25))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_168_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,9))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,25))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_169_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,9))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,25))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_170_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var slash_no_default_var
if(
(slash_no_default_var=slash_no_default_rule(p))
)
{_res=slash_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var slash_with_default_var
if(
(slash_with_default_var=slash_with_default_rule(p))
)
{_res=slash_with_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_171_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_172_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_173_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_174_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_no_default_var
while(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_175_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var slash_no_default_var
if(
(slash_no_default_var=slash_no_default_rule(p))
)
{_res=slash_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var slash_with_default_var
if(
(slash_with_default_var=slash_with_default_rule(p))
)
{_res=slash_with_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_176_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_177_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var param_no_default_var
if(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_178_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_179_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_180_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_181_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _tmp_280_var
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_tmp_280_var=_tmp_280_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,_tmp_280_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_182_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var param_no_default_var
if(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_183_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_maybe_default_var
while(
(param_maybe_default_var=param_maybe_default_rule(p))
)
{_res=param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_184_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var param_no_default_var
if(
(param_no_default_var=param_no_default_rule(p))
)
{_res=param_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_185_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,16))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,35))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,17))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_186_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var param_with_default_var
while(
(param_with_default_var=param_with_default_rule(p))
)
{_res=param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_187_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var lambda_slash_no_default_var
if(
(lambda_slash_no_default_var=lambda_slash_no_default_rule(p))
)
{_res=lambda_slash_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lambda_slash_with_default_var
if(
(lambda_slash_with_default_var=lambda_slash_with_default_rule(p))
)
{_res=lambda_slash_with_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_188_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_189_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_190_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
while(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop0_192_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=lambda_param_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_191_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=lambda_param_rule(p))
&&
(seq=_loop0_192_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_193_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var lambda_slash_no_default_var
if(
(lambda_slash_no_default_var=lambda_slash_no_default_rule(p))
)
{_res=lambda_slash_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lambda_slash_with_default_var
if(
(lambda_slash_with_default_var=lambda_slash_with_default_rule(p))
)
{_res=lambda_slash_with_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_194_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_195_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
if(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_196_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_197_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_198_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_with_default_var
while(
(lambda_param_with_default_var=lambda_param_with_default_rule(p))
)
{_res=lambda_param_with_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_199_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
var _tmp_281_var
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(_tmp_281_var=_tmp_281_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,_tmp_281_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_200_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
if(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_201_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var lambda_param_maybe_default_var
while(
(lambda_param_maybe_default_var=lambda_param_maybe_default_rule(p))
)
{_res=lambda_param_maybe_default_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_202_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var lambda_param_no_default_var
if(
(lambda_param_no_default_var=lambda_param_no_default_rule(p))
)
{_res=lambda_param_no_default_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_203_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,16))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,35))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,17))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_204_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_205_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _loop0_282_var
var _opt_var
UNUSED(_opt_var)
var bitwise_or_var
if(
(bitwise_or_var=bitwise_or_rule(p))
&&
(_loop0_282_var=_loop0_282_rule(p))
&&
(_opt_var=$B._PyPegen.expect_token(p,12),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,bitwise_or_var,_loop0_282_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_207_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=dotted_name_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_206_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=dotted_name_rule(p))
&&
(seq=_loop0_207_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_208_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_283_var
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
&&
(_tmp_283_var=_tmp_283_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,name_var,_tmp_283_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_209_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _tmp_284_var
var name_var
if(
(name_var=$B._PyPegen.name_token(p))
&&
(_tmp_284_var=_tmp_284_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,name_var,_tmp_284_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_211_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_285_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_210_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_285_rule(p))
&&
(seq=_loop0_211_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_213_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_286_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_212_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_286_rule(p))
&&
(seq=_loop0_213_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_215_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_287_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_214_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_287_rule(p))
&&
(seq=_loop0_215_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_217_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_288_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_216_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_288_rule(p))
&&
(seq=_loop0_217_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_218_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,677))
)
{_res=_keyword
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _keyword
if(
(_keyword=$B._PyPegen.expect_token(p,673))
)
{_res=_keyword
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_219_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var block_var
while(
(block_var=block_rule(p))
)
{_res=block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_220_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var except_block_var
while(
(except_block_var=except_block_rule(p))
)
{_res=except_block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_221_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_222_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var block_var
while(
(block_var=block_rule(p))
)
{_res=block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _loop1_223_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var except_star_block_var
while(
(except_star_block_var=except_star_block_rule(p))
)
{_res=except_star_block_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_224_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_289_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,expression_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_225_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_226_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_227_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_228_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_229_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_230_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var positional_patterns_var
if(
(positional_patterns_var=positional_patterns_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=$B._PyPegen.dummy_name(p,positional_patterns_var,_literal)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_231_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var expression_var
if(
(_literal=$B._PyPegen.expect_token(p,51))
&&
(expression_var=expression_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,expression_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_232_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var expression_var
if(
(_literal=$B._PyPegen.expect_token(p,51))
&&
(expression_var=expression_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,expression_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_233_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_opt_var=arguments_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B._PyPegen.dummy_name(p,_literal,_opt_var,_literal_1)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_234_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var _literal_1
var _opt_var
UNUSED(_opt_var)
if(
(_literal=$B._PyPegen.expect_token(p,7))
&&
(_opt_var=arguments_rule(p),!p.error_indicator)
&&
(_literal_1=$B._PyPegen.expect_token(p,8))
)
{_res=$B._PyPegen.dummy_name(p,_literal,_opt_var,_literal_1)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_236_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=double_starred_kvpair_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_235_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=double_starred_kvpair_rule(p))
&&
(seq=_loop0_236_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_237_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_238_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_239_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_240_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_241_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_242_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_243_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_244_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var fstring_format_spec_var
while(
(fstring_format_spec_var=fstring_format_spec_rule(p))
)
{_res=fstring_format_spec_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_245_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_246_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_247_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_248_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,54))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_249_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_250_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_251_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_252_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var fstring_format_spec_var
while(
(fstring_format_spec_var=fstring_format_spec_rule(p))
)
{_res=fstring_format_spec_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_253_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var name_var
if(
(_literal=$B._PyPegen.expect_token(p,54))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_254_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,26))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop1_255_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_290_var
while(
(_tmp_290_var=_tmp_290_rule(p))
)
{_res=_tmp_290_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _loop1_256_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var tstring_var
while(
(tstring_var=tstring_rule(p))
)
{_res=tstring_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
if(_n==0 ||p.error_indicator){return NULL}
return _children}
function _tmp_257_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var fstring_var
if(
(fstring_var=fstring_rule(p))
)
{_res=fstring_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var string_var
if(
(string_var=string_rule(p))
)
{_res=string_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_258_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,14))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,15))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,16))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,17))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,24))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,47))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,49))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_259_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,14))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,15))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,31))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_260_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var z
if(
(z=star_targets_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_261_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,23))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,52))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_262_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,23))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,52))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_263_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var f
var newline_var
if(
(_literal=$B._PyPegen.expect_token(p,49))
&&
(f=named_expression_rule(p))
&&
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=f
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_264_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var c
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(c=expression_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_265_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var c
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(c=star_expression_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_266_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var c
if(
(_keyword=$B._PyPegen.expect_token(p,588))
&&
(c=conjunction_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_267_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var c
if(
(_keyword=$B._PyPegen.expect_token(p,589))
&&
(c=inversion_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_268_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var slice_var
if(
(slice_var=slice_rule(p))
)
{_res=slice_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var starred_expression_var
if(
(starred_expression_var=starred_expression_rule(p))
)
{_res=starred_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_269_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var fstring_var
if(
(fstring_var=fstring_rule(p))
)
{_res=fstring_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var string_var
if(
(string_var=string_rule(p))
)
{_res=string_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_270_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var z
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(z=disjunction_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_271_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var z
if(
(_keyword=$B._PyPegen.expect_token(p,682))
&&
(z=disjunction_rule(p))
)
{_res=z
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_272_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var starred_expression_var
if(
(starred_expression_var=starred_expression_rule(p))
)
{_res=starred_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_291_var
if(
(_tmp_291_var=_tmp_291_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,22)
)
{_res=_tmp_291_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_273_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var c
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(c=star_target_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_274_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var c
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(c=star_target_rule(p))
)
{_res=c
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_275_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _gather_292_var
var _literal
var kwargs_var
if(
(_gather_292_var=_gather_292_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,12))
&&
(kwargs_var=kwargs_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_gather_292_var,_literal,kwargs_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_276_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var starred_expression_var
if(
(starred_expression_var=starred_expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,22)
)
{_res=starred_expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_277_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var expression_without_invalid_var
if(
$B._PyPegen.lookahead(0,$B._PyPegen.string_token,p)
&&
(expression_without_invalid_var=expression_without_invalid_rule(p))
)
{_res=expression_without_invalid_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_278_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var star_targets_var
if(
(star_targets_var=star_targets_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=$B._PyPegen.dummy_name(p,star_targets_var,_literal)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_279_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var star_targets_var
if(
(star_targets_var=star_targets_rule(p))
&&
(_literal=$B._PyPegen.expect_token(p,22))
)
{_res=$B._PyPegen.dummy_name(p,star_targets_var,_literal)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_280_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,35))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_281_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,11))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,35))
)
{_res=_literal
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_282_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _tmp_294_var
while(
(_tmp_294_var=_tmp_294_rule(p))
)
{_res=_tmp_294_var
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _tmp_283_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,13))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_284_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,12))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,8))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _literal
if(
(_literal=$B._PyPegen.expect_token(p,13))
)
{_res=_literal
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var newline_var
if(
(newline_var=$B._PyPegen.expect_token(p,NEWLINE))
)
{_res=newline_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_285_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_295_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,expression_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_286_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var expressions_var
if(
(expressions_var=expressions_rule(p))
&&
(_opt_var=_tmp_296_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,expressions_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_287_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var expression_var
if(
(expression_var=expression_rule(p))
&&
(_opt_var=_tmp_297_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,expression_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_288_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _opt_var
UNUSED(_opt_var)
var expressions_var
if(
(expressions_var=expressions_rule(p))
&&
(_opt_var=_tmp_298_rule(p),!p.error_indicator)
)
{_res=$B._PyPegen.dummy_name(p,expressions_var,_opt_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_289_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var name_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(name_var=$B._PyPegen.name_token(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,name_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_290_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var fstring_var
if(
(fstring_var=fstring_rule(p))
)
{_res=fstring_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var string_var
if(
(string_var=string_rule(p))
)
{_res=string_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_291_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var assignment_expression_var
if(
(assignment_expression_var=assignment_expression_rule(p))
)
{_res=assignment_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,53)
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _loop0_293_rule(p)
{if(p.error_indicator){return NULL}
var _res={value:NULL}
_res=NULL
var _mark=p.mark
var _children=[]
var _children_capacity=1
var _n=0
{
if(p.error_indicator){return NULL}
var _literal
var elem
while(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(elem=_tmp_299_rule(p))
)
{_res=elem
_children[_n++]=_res
_mark=p.mark}
p.mark=_mark}
return _children}
function _gather_292_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var elem
var seq
if(
(elem=_tmp_299_rule(p))
&&
(seq=_loop0_293_rule(p))
)
{_res=$B._PyPegen.seq_insert_in_front(p,elem,seq)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_294_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _literal
var bitwise_or_var
if(
(_literal=$B._PyPegen.expect_token(p,12))
&&
(bitwise_or_var=bitwise_or_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_literal,bitwise_or_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_295_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var star_target_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(star_target_var=star_target_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,star_target_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_296_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var star_target_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(star_target_var=star_target_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,star_target_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_297_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var star_target_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(star_target_var=star_target_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,star_target_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_298_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var _keyword
var star_target_var
if(
(_keyword=$B._PyPegen.expect_token(p,680))
&&
(star_target_var=star_target_rule(p))
)
{_res=$B._PyPegen.dummy_name(p,_keyword,star_target_var)
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_299_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var starred_expression_var
if(
(starred_expression_var=starred_expression_rule(p))
)
{_res=starred_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var _tmp_300_var
if(
(_tmp_300_var=_tmp_300_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,22)
)
{_res=_tmp_300_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
function _tmp_300_rule(p)
{if(p.error_indicator){return NULL}
while(1){var _res=NULL
var _mark=p.mark
{
if(p.error_indicator){return NULL}
var assignment_expression_var
if(
(assignment_expression_var=assignment_expression_rule(p))
)
{_res=assignment_expression_var
break}
p.mark=_mark}
{
if(p.error_indicator){return NULL}
var expression_var
if(
(expression_var=expression_rule(p))
&&
$B._PyPegen.lookahead_with_int(0,$B._PyPegen.expect_token,p,53)
)
{_res=expression_var
break}
p.mark=_mark}
_res=NULL
break}
return _res}
$B._PyPegen.parse=function(p){p.keywords=reserved_keywords
p.n_keyword_lists=n_keyword_lists
p.soft_keywords=soft_keywords
switch(p.mode){case 'file':
return file_rule(p)
case 'eval':
return eval_rule(p)
case 'single':
return interactive_rule(p)
default:
console.log('unknown mode',p.mode)
throw Error(`unknown parse mode: ${p.mode}`)}};})(__BRYTHON__)
;
