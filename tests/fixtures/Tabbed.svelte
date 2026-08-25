%s
 <script lang="python"> 	label = "tabbed"  	def shout(): 		return label.upper() </script>  <p data-k="label">{shout()}</p> | sed s/\t/	/g